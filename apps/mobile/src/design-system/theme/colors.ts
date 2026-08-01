export type SemanticColors = Readonly<{
  accent: string;
  accentContrast: string;
  background: string;
  border: string;
  danger: string;
  success: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  warning: string;
}>;

export const lightColors: SemanticColors = {
  accent: '#176B5B',
  accentContrast: '#FFFFFF',
  background: '#F4F7F5',
  border: '#CDD8D3',
  danger: '#B42318',
  success: '#287A4D',
  surface: '#FFFFFF',
  textPrimary: '#12221E',
  textSecondary: '#50635C',
  warning: '#8A5700',
};

export const darkColors: SemanticColors = {
  accent: '#74D3BC',
  accentContrast: '#092C24',
  background: '#0D1714',
  border: '#344942',
  danger: '#FFB4AB',
  success: '#83D5A5',
  surface: '#18251F',
  textPrimary: '#EEF7F3',
  textSecondary: '#B4C8BF',
  warning: '#F7C56C',
};
