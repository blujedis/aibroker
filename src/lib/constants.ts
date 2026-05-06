export const colors = {
  light: {
    primary: '#3692d6',
    secondary: '#43435b',
    fillPrimary: 'fill-[#3692d6]',
    fillSecondary: 'fill-[#43435b]',
  },
  dark: {
    primary: '#3692d6',
    secondary: '#efefef',
    fillPrimary: 'fill-[#3692d6]',
    fillSecondary: 'fill-[#efefef]',
  }
};

export const getColorsByMode = (mode: 'light' | 'dark') => colors[mode];
