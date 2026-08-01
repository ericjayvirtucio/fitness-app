import { ApplicationShellScreen } from '../../src/features/application-shell/ApplicationShellScreen';
import { getTabDestination } from '../../src/navigation/tab-destinations';

export default function NutritionScreen() {
  return <ApplicationShellScreen {...getTabDestination('nutrition')} />;
}
