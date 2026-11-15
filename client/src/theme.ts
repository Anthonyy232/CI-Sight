import {createTheme, MantineColorsTuple} from '@mantine/core';

// Shade 6 is the logo colour.
const primary: MantineColorsTuple = [
  '#e7f7f1',
  '#c8ecdf',
  '#96dac4',
  '#66c6a9',
  '#3fb293',
  '#1b8f73',
  '#0f7a63',
  '#0b6653',
  '#085444',
  '#054236',
];

export const theme = createTheme({
  primaryColor: 'primary',
  primaryShade: 6,
  colors: {
    primary,
  },
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Card: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
    },
    Badge: {
      styles: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});
