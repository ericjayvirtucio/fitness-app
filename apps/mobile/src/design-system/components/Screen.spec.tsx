import { render, screen } from '@testing-library/react-native';
import { AppText } from './AppText';
import { Screen } from './Screen';

describe('Screen', () => {
  it('scrolls by default for large and dynamically scaled content', async () => {
    await render(
      <Screen testID="screen-content">
        <AppText>Content</AppText>
      </Screen>,
    );

    expect(screen.getByTestId('screen-content')).toHaveProp(
      'keyboardShouldPersistTaps',
      'handled',
    );
  });

  it('supports a static layout without rendering a scroll view', async () => {
    await render(
      <Screen isScrollable={false} testID="screen-content">
        <AppText>Static content</AppText>
      </Screen>,
    );

    expect(screen.getByText('Static content')).toBeOnTheScreen();
    expect(screen.getByTestId('screen-content')).not.toHaveProp(
      'keyboardShouldPersistTaps',
    );
  });

  it('dismisses the keyboard when a keyboard-aware screen is dragged', async () => {
    await render(
      <Screen isKeyboardAware testID="screen-content">
        <AppText>Form content</AppText>
      </Screen>,
    );

    expect(screen.getByTestId('screen-content')).toHaveProp(
      'keyboardDismissMode',
      'on-drag',
    );
  });
});
