import {createTheme, MantineColorsTuple} from '@mantine/core';

const primary: MantineColorsTuple = [
  '#eef3ff',
  '#dce4f5',
  '#b9c7e8',
  '#94a8dd',
  '#748cd3',
  '#5f7acd',
  '#5171cb',
  '#4161b5',
  '#3755a2',
  '#2a4890',
];

export const theme = createTheme({
  primaryColor: 'primary',
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
        shadow: 'sm',
      },
    },
    Table: {
      styles: {
        th: {
          textTransform: 'uppercase',
          fontSize: '12px',
          letterSpacing: '0.5px',
        },
      },
    },
  },
});