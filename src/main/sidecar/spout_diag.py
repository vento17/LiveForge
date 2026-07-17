#!/usr/bin/env python3
"""
Standalone Spout D3D11 diagnostic — run this while MadMapper is streaming Spout.
Prints exactly what happens at each step of the D3D11 pipeline.
"""
import sys, os, ctypes, time

_VENDOR = os.path.join(os.path.dirname(__file__), 'vendor')
if os.path.isdir(_VENDOR):
    sys.path.insert(0, _VENDOR)
sys.path.insert(0, os.path.dirname(__file__))

# ── numpy / Pillow ────────────────────────────────────────────────────────────
try:
    import numpy as np
    from PIL import Image as PILImage
    print("numpy/Pillow: OK")
except ImportError as e:
    print(f"numpy/Pillow MISSING: {e}"); sys.exit(1)

# ── Spout ─────────────────────────────────────────────────────────────────────
try:
    from spout import SpoutUtils
    print("SpoutUtils: OK")
except Exception as e:
    print(f"SpoutUtils FAILED: {e}"); sys.exit(1)

SENDER = sys.argv[1] if len(sys.argv) > 1 else "Video-Output-1"
print(f"\nTarget sender: '{SENDER}'")

# List all senders
with SpoutUtils() as u:
    senders = u.get_all_senders()
print(f"Active senders: {senders}")

# Get sender info
with SpoutUtils() as u:
    info = u.get_sender_info(SENDER)
print(f"get_sender_info('{SENDER}') = {info}")
if not info or info[0] == 0:
    print("ERROR: sender not found or width=0"); sys.exit(1)

new_w, new_h, new_handle, new_fmt = info
print(f"  dims={new_w}x{new_h}  handle={hex(new_handle if new_handle >= 0 else new_handle + 2**64)}  fmt={new_fmt}")

# ── D3D11 structures ──────────────────────────────────────────────────────────
class _GUID(ctypes.Structure):
    _fields_ = [('Data1', ctypes.c_uint32), ('Data2', ctypes.c_uint16),
                 ('Data3', ctypes.c_uint16), ('Data4', ctypes.c_uint8 * 8)]

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

IID_IDXGIFactory = _GUID(0x7b7166ec, 0x21c7, 0x44ae,
                          (ctypes.c_uint8 * 8)(0xb2, 0x1a, 0xc9, 0xae, 0x32, 0x1a, 0xe3, 0x69))
IID_D3DTex2D     = _GUID(0x6F15AAF2, 0xD208, 0x4E89,
                          (ctypes.c_uint8 * 8)(0x9A, 0xB4, 0x48, 0x95, 0x35, 0xD3, 0x4F, 0x9C))

_D3D11_USAGE_STAGING   = 3
_D3D11_CPU_ACCESS_READ = 0x20000
_D3D11_MAP_READ        = 1

_FN_CACHE: dict = {}
def _d3d(com_ptr, slot, restype, argtypes):
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
        try: _d3d(ptr, 2, ctypes.c_ulong, [])(ptr)
        except: pass

def _handle_c(raw: int) -> ctypes.c_void_p:
    return ctypes.c_void_p(raw if raw >= 0 else raw)  # c_void_p accepts signed ints

# ── Load D3D11 / DXGI ─────────────────────────────────────────────────────────
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
dxgi.CreateDXGIFactory.argtypes = [ctypes.POINTER(_GUID), ctypes.POINTER(ctypes.c_void_p)]

# ── Create DXGI factory ───────────────────────────────────────────────────────
factory = ctypes.c_void_p(0)
hr = dxgi.CreateDXGIFactory(ctypes.byref(IID_IDXGIFactory), ctypes.byref(factory))
print(f"\nCreateDXGIFactory: hr={hr:#x}  factory={factory.value}")
if hr != 0 or not factory.value:
    print("ERROR: CreateDXGIFactory failed"); sys.exit(1)

h = _handle_c(new_handle)
print(f"Handle as c_void_p: {h.value}  (hex: {hex(h.value if h.value >= 0 else h.value + 2**64)})")

# ── Enumerate adapters ────────────────────────────────────────────────────────
print("\n--- Adapter enumeration ---")
dev_found = ctx_found = None

for idx in range(8):
    adapter = ctypes.c_void_p(0)
    hr = _d3d(factory.value, 7, ctypes.c_long,
              [ctypes.c_uint, ctypes.POINTER(ctypes.c_void_p)])(
        factory.value, idx, ctypes.byref(adapter))
    if hr != 0:
        print(f"Adapter {idx}: EnumAdapters hr={hr:#x} (no more adapters)")
        break

    dev = ctypes.c_void_p(0); ctx = ctypes.c_void_p(0)
    hr = d3d11.D3D11CreateDevice(adapter, 0, None, 0, None, 0, 7,
                                  ctypes.byref(dev), None, ctypes.byref(ctx))
    _com_release(adapter.value)
    print(f"Adapter {idx}: D3D11CreateDevice hr={hr:#x}  dev={dev.value}", end='  ')

    if hr != 0 or not dev.value:
        print("SKIP")
        continue

    tex = ctypes.c_void_p(0)
    hr2 = _d3d(dev.value, 28, ctypes.c_long,
               [ctypes.c_void_p, ctypes.POINTER(_GUID),
                ctypes.POINTER(ctypes.c_void_p)])(
        dev.value, h, ctypes.byref(IID_D3DTex2D), ctypes.byref(tex))
    print(f"OpenSharedResource hr={hr2:#x}  tex={tex.value}", end='  ')

    if hr2 == 0 and tex.value:
        _com_release(tex.value)
        print("<-- WINNER")
        if dev_found is None:
            dev_found, ctx_found = dev.value, ctx.value
        else:
            _com_release(ctx.value); _com_release(dev.value)
    else:
        print()
        _com_release(ctx.value); _com_release(dev.value)

_com_release(factory.value)

if dev_found is None:
    print("\nERROR: No adapter can open the shared handle. Spout cannot work."); sys.exit(1)

print(f"\nUsing dev={dev_found}  ctx={ctx_found}")

# ── Open shared texture ───────────────────────────────────────────────────────
shared_tex = ctypes.c_void_p(0)
hr = _d3d(dev_found, 28, ctypes.c_long,
          [ctypes.c_void_p, ctypes.POINTER(_GUID), ctypes.POINTER(ctypes.c_void_p)])(
    dev_found, h, ctypes.byref(IID_D3DTex2D), ctypes.byref(shared_tex))
print(f"OpenSharedResource (main): hr={hr:#x}  tex={shared_tex.value}")
if hr != 0 or not shared_tex.value:
    print("ERROR: Cannot open shared texture"); sys.exit(1)

# ── Create staging texture ────────────────────────────────────────────────────
desc = _D3D11_TEXTURE2D_DESC(
    Width=new_w, Height=new_h, MipLevels=1, ArraySize=1,
    Format=new_fmt, SampleDesc_Count=1, SampleDesc_Quality=0,
    Usage=_D3D11_USAGE_STAGING, BindFlags=0,
    CPUAccessFlags=_D3D11_CPU_ACCESS_READ, MiscFlags=0)
stg = ctypes.c_void_p(0)
hr = _d3d(dev_found, 5, ctypes.c_long,
          [ctypes.POINTER(_D3D11_TEXTURE2D_DESC), ctypes.c_void_p,
           ctypes.POINTER(ctypes.c_void_p)])(
    dev_found, ctypes.byref(desc), None, ctypes.byref(stg))
print(f"CreateTexture2D (staging {new_w}x{new_h} fmt={new_fmt}): hr={hr:#x}  stg={stg.value}")
if hr != 0 or not stg.value:
    print("ERROR: Cannot create staging texture"); sys.exit(1)

# ── CopyResource → Map → read pixels ─────────────────────────────────────────
print("\nCapturing 3 frames...")
for i in range(3):
    time.sleep(1/30)
    _d3d(ctx_found, 47, None, [ctypes.c_void_p, ctypes.c_void_p])(ctx_found, stg.value, shared_tex.value)

    mapped = _D3D11_MAPPED()
    hr = _d3d(ctx_found, 14, ctypes.c_long,
              [ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint,
               ctypes.c_uint, ctypes.POINTER(_D3D11_MAPPED)])(
        ctx_found, stg.value, 0, _D3D11_MAP_READ, 0, ctypes.byref(mapped))
    print(f"  Frame {i}: Map hr={hr:#x}  pData={mapped.pData}  pitch={mapped.RowPitch}", end='')
    if hr == 0 and mapped.pData:
        pitch = mapped.RowPitch
        raw = (ctypes.c_ubyte * (new_h * pitch)).from_address(mapped.pData)
        arr = np.frombuffer(raw, dtype=np.uint8).reshape(new_h, pitch // 4, 4)
        bgra = np.array(arr[:, :new_w, :])
        _d3d(ctx_found, 15, None, [ctypes.c_void_p, ctypes.c_uint])(ctx_found, stg.value, 0)
        psum = int(bgra.sum())
        pmax = int(bgra.max())
        print(f"  pixel_sum={psum}  pixel_max={pmax}", end='')
        if pmax > 0:
            # Save a test JPEG
            if new_fmt == 28:
                rgb = np.ascontiguousarray(bgra[:, :, :3])
            else:
                rgb = np.ascontiguousarray(bgra[:, :, [2, 1, 0]])
            out = os.path.join(os.path.dirname(__file__), f'diag_frame_{i}.jpg')
            PILImage.fromarray(rgb, 'RGB').save(out, quality=70)
            print(f"  → saved {out}")
        else:
            print("  ← ALL BLACK")
    else:
        print()

_com_release(stg.value)
_com_release(shared_tex.value)
_com_release(ctx_found)
_com_release(dev_found)
print("\nDone.")
