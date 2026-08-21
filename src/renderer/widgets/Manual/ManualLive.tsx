import React from 'react';
import type { ManualWidget } from '../../../shared/types/project';
import ManualView from './ManualView';

export default function ManualLive({ widget }: { widget: ManualWidget }): React.JSX.Element {
  return <ManualView widget={widget} interactive />;
}
