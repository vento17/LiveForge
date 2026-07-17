import React from 'react';
import type { RouterWidget } from '../../../shared/types/project';
import RouterDesign from './RouterDesign';

// Live rendering is display-only. All routing (for every router on every page)
// runs in the global RouterEngine mounted once by LiveMode, so cross-page links
// work even while this router's page is not shown.
export default function RouterLive({ widget }: { widget: RouterWidget }): React.JSX.Element {
  return <RouterDesign widget={widget} />;
}
