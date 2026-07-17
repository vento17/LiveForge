#!/usr/bin/env python3
"""
LiveForge Spout / NDI sidecar — MJPEG preview server
Port 8765  (127.0.0.1 only)

Endpoints:
  GET /health                     → {"ok": true}
  GET /spout/sources              → {"sources": [...], "ok": bool}
  GET /ndi/sources                → {"sources": [...], "ok": bool}
  GET /spout/mjpeg/<senderName>   → multipart/x-mixed-replace MJPEG
  GET /ndi/mjpeg/<sourceName>     → multipart/x-mixed-replace MJPEG
"""
import sys
import os

# When frozen by PyInstaller, _MEIPASS is the extraction directory.
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    _BASE = sys._MEIPASS
else:
    _BASE = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, _BASE)

# Vendor packages (bundled numpy / Pillow) — must precede all other imports.
# Populate once: pip install --target src/main/sidecar/vendor/ numpy Pillow
_VENDOR = os.path.join(_BASE, 'vendor')
if os.path.isdir(_VENDOR):
    sys.path.insert(0, _VENDOR)

import io
import json
import time
import ctypes
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

PORT = 8765
JPEG_QUALITY = 70

# ─── Optional imaging deps ────────────────────────────────────────────────────

try:
    import numpy as np
    from PIL import Image as PILImage
    _IMAGING = True
except ImportError:
    _IMAGING = False
    print('[sidecar] WARNING: numpy/Pillow missing. '
          'Run: pip install --target src/main/sidecar/vendor/ numpy Pillow', flush=True)

# ─── Spout ────────────────────────────────────────────────────────────────────

try:
    from spout import SpoutUtils
    _SPOUT = True
    print('[sidecar] Spout: OK', flush=True)
except Exception as _spout_err:
    _SPOUT = False
    print(f'[sidecar] Spout unavailable: {_spout_err}', flush=True)

# ─── NDI ──────────────────────────────────────────────────────────────────────

try:
    from ndi import NDISourceFinder, NDIReceiver
    _NDI = True
    print('[sidecar] NDI: OK', flush=True)
except Exception as _ndi_err:
    _NDI = False
    print(f'[sidecar] NDI unavailable: {_ndi_err}', flush=True)


# ─── Frame store (one per active stream) ─────────────────────────────────────

class FrameStore:
    def __init__(self):
        self._lock = threading.Lock()
        self._cond = threading.Condition(self._lock)
        self.frame: bytes | None = None
        self.frame_no = 0
        self.running = True
        self.clients = 0

    def put(self, jpeg: bytes):
        with self._cond:
            self.frame = jpeg
            self.frame_no += 1
            self._cond.notify_all()

    def wait_next(self, last_no: int, timeout: float = 2.0) -> tuple[bytes | None, int]:
        with self._cond:
            self._cond.wait_for(lambda: self.frame_no != last_no or not self.running,
                                timeout=timeout)
            return self.frame, self.frame_no


_spout_streams: dict[str, tuple[FrameStore, threading.Thread]] = {}
_ndi_streams:   dict[str, tuple[FrameStore, threading.Thread]] = {}
_registry_lock = threading.Lock()


# ─── JPEG helper ──────────────────────────────────────────────────────────────

def _rgb_to_jpeg(rgb_arr: 'np.ndarray') -> bytes:
    img = PILImage.fromarray(rgb_arr, 'RGB')
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=JPEG_QUALITY, optimize=False)
    return buf.getvalue()


# ─── NDI background discovery ─────────────────────────────────────────────────
# Keep a single NDISourceFinder alive so mDNS state accumulates over time.

_ndi_sources_cache: list[str] = []
_ndi_sources_lock  = threading.Lock()


def _ndi_discovery_loop():
    last: list[str] = []
    try:
        with NDISourceFinder(show_local_sources=True) as finder:
            finder.wait(timeout_ms=2000)
            while True:
                raw      = finder.get_sources()
                filtered = [s for s in raw if 'Remote Connection' not in s]
                with _ndi_sources_lock:
                    _ndi_sources_cache[:] = filtered
                if filtered != last:
                    print(f'[ndi:discovery] {filtered}', flush=True)
                    last = filtered[:]
                time.sleep(1.0)
    except Exception as e:
        print(f'[ndi:discovery] error: {e}', flush=True)


if _NDI:
    threading.Thread(target=_ndi_discovery_loop, daemon=True,
                     name='ndi:discovery').start()


# ─── D3D11 helpers for Spout direct texture read ──────────────────────────────
# Reads Spout shared textures via D3D11 staging copy — no OpenGL needed.

class _GUID(ctypes.Structure):
    _fields_ = [('Data1', ctypes.c_uint32), ('Data2', ctypes.c_uint16),
                 ('Data3', ctypes.c_uint16), ('Data4', ctypes.c_uint8 * 8)]

_IID_IDXGIFactory    = _GUID(0x7b7166ec, 0x21c7, 0x44ae,
                              (ctypes.c_uint8 * 8)(0xb2, 0x1a, 0xc9, 0xae, 0x32, 0x1a, 0xe3, 0x69))
_IID_D3DTex2D        = _GUID(0x6F15AAF2, 0xD208, 0x4E89,
                              (ctypes.c_uint8 * 8)(0x9A, 0xB4, 0x48, 0x95, 0x35, 0xD3, 0x4F, 0x9C))
_IID_IDXGIKeyedMutex = _GUID(0x9D8E1289, 0xD7B3, 0x465F,
                              (ctypes.c_uint8 * 8)(0x81, 0x26, 0x25, 0x0E, 0x34, 0x9A, 0xF8, 0x5D))

class _D3D11_TEXTURE2D_DESC(ctypes.Structure):
    _fields_ = [
        ('Width', ctypes.c_uint), ('Height', ctypes.c_uint),
        ('MipLevels', ctypes.c_uint), ('ArraySize', ctypes.c_uint),
        ('Format', ctypes.c_uint),
        ('SampleDesc_Count', ctypes.c_uint), ('SampleDesc_Quality', ctypes.c_uint),
        ('Usage', ctypes.c_uint), ('BindFlags', ctypes.c_uint),
        ('CPUAccessFlags', ctypes.c_uint), ('MiscFlags', ctypes.c_uint),
    ]

class _D3D11_MAPPED(ctypes.Structure):
    _fields_ = [('pData', ctypes.c_void_p), ('RowPitch', ctypes.c_uint),
                 ('DepthPitch', ctypes.c_uint)]

_D3D11_USAGE_STAGING   = 3
_D3D11_CPU_ACCESS_READ = 0x20000
_D3D11_MAP_READ        = 1

_FN_CACHE: dict = {}


def _d3d(com_ptr, slot, restype, argtypes):
    """Return a callable for a COM vtable method (cached CFUNCTYPE)."""
    vtbl   = ctypes.cast(com_ptr, ctypes.POINTER(ctypes.c_void_p))[0]
    fn_ptr = ctypes.cast(vtbl,    ctypes.POINTER(ctypes.c_void_p))[slot]
    key = (restype, tuple(argtypes))
    FnType = _FN_CACHE.get(key)
    if FnType is None:
        FnType = ctypes.CFUNCTYPE(restype, ctypes.c_void_p, *argtypes)
        _FN_CACHE[key] = FnType
    return FnType(fn_ptr)


def _com_release(ptr):
    if ptr:
        try:
            _d3d(ptr, 2, ctypes.c_ulong, [])(ptr)
        except Exception:
            pass


def _handle_c(raw: int) -> ctypes.c_void_p:
    """Convert an unsigned 64-bit Spout handle to a ctypes c_void_p."""
    return ctypes.c_void_p(raw if raw < 2**63 else raw - 2**64)


def _spout_find_device(handle: int):
    """
    Enumerate DXGI adapters to find the one that can open the Spout shared
    handle (must be on the same physical GPU as the sender).
    Returns (dev_ptr, ctx_ptr) ints or (None, None).
    """
    d3d11 = ctypes.WinDLL('d3d11')
    dxgi  = ctypes.WinDLL('dxgi')
    d3d11.D3D11CreateDevice.restype  = ctypes.c_long
    d3d11.D3D11CreateDevice.argtypes = [
        ctypes.c_void_p, ctypes.c_uint, ctypes.c_void_p, ctypes.c_uint,
        ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint,
        ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p,
        ctypes.POINTER(ctypes.c_void_p),
    ]
    dxgi.CreateDXGIFactory.restype  = ctypes.c_long
    dxgi.CreateDXGIFactory.argtypes = [ctypes.POINTER(_GUID),
                                        ctypes.POINTER(ctypes.c_void_p)]

    factory = ctypes.c_void_p(0)
    if dxgi.CreateDXGIFactory(ctypes.byref(_IID_IDXGIFactory),
                               ctypes.byref(factory)) != 0:
        return None, None

    h = _handle_c(handle)
    result = None, None

    for idx in range(8):
        adapter = ctypes.c_void_p(0)
        hr = _d3d(factory.value, 7, ctypes.c_long,
                  [ctypes.c_uint, ctypes.POINTER(ctypes.c_void_p)])(
            factory.value, idx, ctypes.byref(adapter))
        if hr != 0:
            break

        dev = ctypes.c_void_p(0)
        ctx = ctypes.c_void_p(0)
        hr = d3d11.D3D11CreateDevice(
            adapter, 0, None, 0, None, 0, 7,
            ctypes.byref(dev), None, ctypes.byref(ctx))
        _com_release(adapter.value)

        if hr != 0 or not dev.value:
            continue

        tex_test = ctypes.c_void_p(0)
        hr = _d3d(dev.value, 28, ctypes.c_long,
                  [ctypes.c_void_p, ctypes.POINTER(_GUID),
                   ctypes.POINTER(ctypes.c_void_p)])(
            dev.value, h, ctypes.byref(_IID_D3DTex2D), ctypes.byref(tex_test))

        if hr == 0 and tex_test.value:
            _com_release(tex_test.value)
            print(f'[spout] D3D11 device on adapter {idx}', flush=True)
            result = dev.value, ctx.value
            break

        _com_release(ctx.value)
        _com_release(dev.value)

    _com_release(factory.value)
    return result


def _spout_loop(name: str, store: FrameStore):
    if not _SPOUT or not _IMAGING:
        return

    dev = ctx = shared_tex = staging = keyed_mutex = None
    cur_handle = cur_w = cur_h = cur_fmt = 0

    try:
        with SpoutUtils() as u:
            while store.running:
                info = u.get_sender_info(name)
                if not info or info[0] == 0:
                    time.sleep(0.05)
                    continue

                new_w, new_h, new_handle, new_fmt = info

                if dev is None and new_handle:
                    dev, ctx = _spout_find_device(new_handle)
                    if dev is None:
                        print(f'[spout:{name}] no D3D11 device for handle '
                              f'{hex(new_handle)}', flush=True)
                        time.sleep(2.0)
                        continue

                if new_handle != cur_handle and dev:
                    if keyed_mutex:
                        _com_release(keyed_mutex); keyed_mutex = None
                    _com_release(shared_tex); shared_tex = None

                    tex_ptr = ctypes.c_void_p(0)
                    hr = _d3d(dev, 28, ctypes.c_long,
                              [ctypes.c_void_p, ctypes.POINTER(_GUID),
                               ctypes.POINTER(ctypes.c_void_p)])(
                        dev, _handle_c(new_handle),
                        ctypes.byref(_IID_D3DTex2D), ctypes.byref(tex_ptr))
                    if hr == 0 and tex_ptr.value:
                        shared_tex = tex_ptr.value
                        cur_handle = new_handle
                        print(f'[spout:{name}] opened shared tex', flush=True)

                        km = ctypes.c_void_p(0)
                        hr2 = _d3d(shared_tex, 0, ctypes.c_long,
                                   [ctypes.POINTER(_GUID),
                                    ctypes.POINTER(ctypes.c_void_p)])(
                            shared_tex, ctypes.byref(_IID_IDXGIKeyedMutex),
                            ctypes.byref(km))
                        if hr2 == 0 and km.value:
                            keyed_mutex = km.value
                            print(f'[spout:{name}] sync: KeyedMutex', flush=True)
                        else:
                            print(f'[spout:{name}] sync: frame-event fallback '
                                  f'(KeyedMutex QI hr={hr2:#x})', flush=True)
                    else:
                        print(f'[spout:{name}] OpenSharedResource hr={hr:#x}', flush=True)
                        time.sleep(0.1)
                        continue

                if (new_w != cur_w or new_h != cur_h or new_fmt != cur_fmt) and dev:
                    _com_release(staging); staging = None
                    cur_w, cur_h, cur_fmt = new_w, new_h, new_fmt
                    desc = _D3D11_TEXTURE2D_DESC(
                        Width=cur_w, Height=cur_h, MipLevels=1, ArraySize=1,
                        Format=cur_fmt, SampleDesc_Count=1, SampleDesc_Quality=0,
                        Usage=_D3D11_USAGE_STAGING, BindFlags=0,
                        CPUAccessFlags=_D3D11_CPU_ACCESS_READ, MiscFlags=0,
                    )
                    stg = ctypes.c_void_p(0)
                    hr = _d3d(dev, 5, ctypes.c_long,
                              [ctypes.POINTER(_D3D11_TEXTURE2D_DESC), ctypes.c_void_p,
                               ctypes.POINTER(ctypes.c_void_p)])(
                        dev, ctypes.byref(desc), None, ctypes.byref(stg))
                    if hr == 0 and stg.value:
                        staging = stg.value
                        print(f'[spout:{name}] {cur_w}x{cur_h} fmt={cur_fmt}', flush=True)
                    else:
                        print(f'[spout:{name}] CreateTexture2D hr={hr:#x}', flush=True)
                        time.sleep(0.1)
                        continue

                if shared_tex and staging:
                    if keyed_mutex:
                        hr = _d3d(keyed_mutex, 8, ctypes.c_long,
                                  [ctypes.c_uint64, ctypes.c_ulong])(
                            keyed_mutex, 0, 100)
                        copy_ok = (hr == 0)
                    else:
                        # No KeyedMutex (legacy D3D11_RESOURCE_MISC_SHARED).
                        # Wait up to 33ms for sender's frame-sync event; if the
                        # sender doesn't call SetFrameSync this returns immediately.
                        # Unconditional sleep lets the GPU finish the sender's
                        # CopyResource before we start reading.
                        u.wait_frame_sync(name, 33)
                        time.sleep(0.005)
                        copy_ok = True

                    if copy_ok:
                        _d3d(ctx, 47, None,
                             [ctypes.c_void_p, ctypes.c_void_p])(ctx, staging, shared_tex)

                        mapped = _D3D11_MAPPED()
                        hr = _d3d(ctx, 14, ctypes.c_long,
                                  [ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint,
                                   ctypes.c_uint, ctypes.POINTER(_D3D11_MAPPED)])(
                            ctx, staging, 0, _D3D11_MAP_READ, 0, ctypes.byref(mapped))

                        if keyed_mutex:
                            _d3d(keyed_mutex, 9, ctypes.c_long,
                                 [ctypes.c_uint64])(keyed_mutex, 0)

                        if hr == 0 and mapped.pData:
                            pitch = mapped.RowPitch
                            raw   = (ctypes.c_ubyte * (cur_h * pitch)).from_address(
                                mapped.pData)
                            arr  = np.frombuffer(raw, dtype=np.uint8).reshape(
                                cur_h, pitch // 4, 4)
                            bgra = np.array(arr[:, :cur_w, :])

                            _d3d(ctx, 15, None,
                                 [ctypes.c_void_p, ctypes.c_uint])(ctx, staging, 0)

                            if cur_fmt == 28:
                                rgb = np.ascontiguousarray(bgra[:, :, :3])
                            else:
                                rgb = np.ascontiguousarray(bgra[:, :, [2, 1, 0]])

                            store.put(_rgb_to_jpeg(rgb))

    except Exception as e:
        print(f'[spout:{name}] error: {e}', flush=True)
    finally:
        _com_release(staging)
        _com_release(shared_tex)
        if keyed_mutex:
            _com_release(keyed_mutex)
        _com_release(ctx)
        _com_release(dev)
        print(f'[spout:{name}] stopped', flush=True)


# ─── NDI receiver loop ────────────────────────────────────────────────────────

def _ndi_loop(name: str, store: FrameStore):
    if not _NDI or not _IMAGING:
        return

    try:
        with NDIReceiver(name, connect_timeout_ms=12000) as rx:
            print(f'[ndi:{name}] receiver connected', flush=True)
            while store.running:
                # Block up to 200 ms for the next frame, encode it immediately.
                with rx.receive(timeout_ms=200) as frame:
                    if not frame:
                        continue
                    arr = frame.as_numpy()[:, :frame.width, :]
                    rgb = np.ascontiguousarray(arr[:, :, [2, 1, 0]])  # BGRX→RGB
                    store.put(_rgb_to_jpeg(rgb))

                # Silently drain any frames that piled up during JPEG encoding.
                # This prevents latency from accumulating — next iteration gets
                # the freshest available frame without re-encoding stale ones.
                while True:
                    with rx.receive(timeout_ms=0) as stale:
                        if not stale:
                            break

    except Exception as e:
        print(f'[ndi:{name}] error: {e}', flush=True)
    finally:
        print(f'[ndi:{name}] stopped', flush=True)


# ─── Stream registry ──────────────────────────────────────────────────────────

def _acquire_stream(registry: dict, name: str, loop_fn) -> FrameStore:
    with _registry_lock:
        if name in registry:
            store, _ = registry[name]
        else:
            store = FrameStore()
            t = threading.Thread(target=loop_fn, args=(name, store),
                                 daemon=True, name=f'rx:{name}')
            t.start()
            registry[name] = (store, t)
        store.clients += 1
        return store


def _release_stream(registry: dict, name: str):
    with _registry_lock:
        entry = registry.get(name)
        if entry is None:
            return
        store, _ = entry
        store.clients -= 1
        if store.clients <= 0:
            store.running = False
            del registry[name]


# ─── HTTP handler ─────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        full  = unquote(self.path)
        path  = full.split('?')[0].rstrip('/')
        qs    = full.split('?')[1] if '?' in full else ''
        fps   = 0
        for part in qs.split('&'):
            if part.startswith('fps='):
                try: fps = max(0, int(part[4:]))
                except ValueError: pass

        if path == '/health':
            self._json({'ok': True, 'spout': _SPOUT, 'ndi': _NDI})
        elif path == '/spout/sources':
            self._serve_spout_sources()
        elif path == '/ndi/sources':
            self._serve_ndi_sources()
        elif path.startswith('/spout/mjpeg/'):
            self._serve_mjpeg(path[len('/spout/mjpeg/'):],
                              _spout_streams, _spout_loop, fps)
        elif path.startswith('/ndi/mjpeg/'):
            self._serve_mjpeg(path[len('/ndi/mjpeg/'):],
                              _ndi_streams, _ndi_loop, fps)
        else:
            self.send_response(404)
            self.end_headers()

    def _serve_spout_sources(self):
        if not _SPOUT:
            self._json({'sources': [], 'ok': False,
                        'error': 'SpoutLibrary.dll unavailable'})
            return
        try:
            with SpoutUtils() as u:
                sources = u.get_all_senders()
            self._json({'sources': sources, 'ok': True})
        except Exception as e:
            self._json({'sources': [], 'ok': False, 'error': str(e)})

    def _serve_ndi_sources(self):
        if not _NDI:
            self._json({'sources': [], 'ok': False,
                        'error': 'NDI Runtime not installed'})
            return
        with _ndi_sources_lock:
            sources = list(_ndi_sources_cache)
        self._json({'sources': sources, 'ok': True})

    def _json(self, data: dict):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _serve_mjpeg(self, name: str, registry: dict, loop_fn, target_fps: int = 0):
        if not name:
            self.send_response(400); self.end_headers(); return
        if not _IMAGING:
            self.send_response(503); self._cors(); self.end_headers()
            self.wfile.write(b'pip install --target vendor/ numpy Pillow')
            return

        min_interval = 1.0 / target_fps if target_fps > 0 else 0.0

        store = _acquire_stream(registry, name, loop_fn)
        try:
            self.send_response(200)
            self.send_header('Content-Type',
                             'multipart/x-mixed-replace; boundary=frame')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self.send_header('Pragma', 'no-cache')
            self._cors()
            self.end_headers()

            last_no   = 0
            last_send = 0.0
            while True:
                jpeg, frame_no = store.wait_next(last_no, timeout=2.0)
                if not store.running:
                    break
                if jpeg is None or frame_no == last_no:
                    continue
                last_no = frame_no
                if min_interval > 0:
                    now = time.monotonic()
                    if now - last_send < min_interval:
                        continue
                    last_send = now
                try:
                    self.wfile.write(b'--frame\r\n')
                    self.wfile.write(b'Content-Type: image/jpeg\r\n')
                    self.wfile.write(
                        f'Content-Length: {len(jpeg)}\r\n\r\n'.encode())
                    self.wfile.write(jpeg)
                    self.wfile.write(b'\r\n')
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError, OSError):
                    break
        finally:
            _release_stream(registry, name)


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(f'[sidecar] ready on http://127.0.0.1:{PORT}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    print('[sidecar] stopped', flush=True)
