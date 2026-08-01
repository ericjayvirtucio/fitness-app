import { ApplicationShellScreen } from '../../src/features/application-shell/ApplicationShellScreen';
import { getTabDestination } from '../../src/navigation/tab-destinations';

export default function ProgressScreen() {
  return <ApplicationShellScreen {...getTabDestination('progress')} />;
}
