import { EmptyState, Screen } from '../../design-system';
import type { TabDestination } from '../../navigation/tab-destinations';

type ApplicationShellScreenProps = Readonly<
  Pick<TabDestination, 'description' | 'title'>
>;

export function ApplicationShellScreen({
  description,
  title,
}: ApplicationShellScreenProps) {
  return (
    <Screen accessibilityLabel={`${title} screen`}>
      <EmptyState description={description} title={title} />
    </Screen>
  );
}
