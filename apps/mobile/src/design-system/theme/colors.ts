export type SemanticColors = Readonly<{
  accent: string;
  background: string;
  border: string;
  danger: string;
  divider: string;
  focus: string;
  information: string;
  onDanger: string;
  onInformation: string;
  onPrimary: string;
  onSecondary: string;
  onSuccess: string;
  onWarning: string;
  overlay: string;
  primary: string;
  secondary: string;
  skeleton: string;
  success: string;
  surface: string;
  surfaceVariant: string;
  textDisabled: string;
  textPrimary: string;
  textSecondary: string;
  warning: string;
}>;

export const lightColors: SemanticColors = {
  accent: '#2F7668',
  background: '#F4F7F5',
  border: '#B8C8C1',
  danger: '#B42318',
  divider: '#DCE5E1',
  focus: '#0B6EDE',
  information: '#175CD3',
  onDanger: '#FFFFFF',
  onInformation: '#FFFFFF',
  onPrimary: '#FFFFFF',
  onSecondary: '#17352E',
  onSuccess: '#FFFFFF',
  onWarning: '#2D1B00',
  overlay: 'rgba(7, 18, 14, 0.56)',
  primary: '#176B5B',
  secondary: '#D8EAE4',
  skeleton: '#D8E2DE',
  success: '#287A4D',
  surface: '#FFFFFF',
  surfaceVariant: '#E9F0ED',
  textDisabled: '#82918B',
  textPrimary: '#12221E',
  textSecondary: '#50635C',
  warning: '#D99A27',
};

export const darkColors: SemanticColors = {
  accent: '#74D3BC',
  background: '#0D1714',
  border: '#526A61',
  danger: '#FFB4AB',
  divider: '#2B3C35',
  focus: '#8FC5FF',
  information: '#A8C7FA',
  onDanger: '#690005',
  onInformation: '#062E6F',
  onPrimary: '#00382E',
  onSecondary: '#0F2E27',
  onSuccess: '#00391F',
  onWarning: '#402D00',
  overlay: 'rgba(0, 0, 0, 0.68)',
  primary: '#74D3BC',
  secondary: '#AFCFC5',
  skeleton: '#344942',
  success: '#83D5A5',
  surface: '#18251F',
  surfaceVariant: '#23332C',
  textDisabled: '#7E9188',
  textPrimary: '#EEF7F3',
  textSecondary: '#B4C8BF',
  warning: '#F7C56C',
};
