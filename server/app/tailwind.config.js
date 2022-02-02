const colors = require('tailwindcss/colors')

module.exports = {
  purge: {
    enabled: false,
    content: [
      './src/views/**/*.ejs',
    ]
  },
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      fontFamily: {
        'quicksand': ['"Quicksand"', 'sans-serif']
      },
      colors: {
        coolgray: colors.coolGray,
        orange: colors.orange
      },
      zIndex: {
        '-10': '-10'
      },
      backgroundImage: {
        'triangles-orange': "url('/images/triangles-orange.png')",
        'triangles-gray': "url('/images/triangles-gray.png')",
        'triangles-gray-mirrored': "url('/images/triangles-gray-mirrored.png')"
      }
    },
  },
  variants: {
    extend: {
      backgroundColor: ['odd', 'disabled'],
      display: ['group-hover'],
      cursor: ['disabled'],
    }
  },
  plugins: [],
}