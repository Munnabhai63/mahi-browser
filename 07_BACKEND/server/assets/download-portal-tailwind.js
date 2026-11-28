if (globalThis.tailwind) {
  globalThis.tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', '"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
          mono: ['"JetBrains Mono"', 'monospace'],
        },
        colors: {
          emerald: {
            400: '#34d399',
            500: '#10b981',
            600: '#059669',
          },
          teal: {
            400: '#2dd4bf',
            500: '#14b8a6',
          },
        },
      },
    },
  };
}
