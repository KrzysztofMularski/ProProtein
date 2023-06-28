const colors = require('tailwindcss/colors')

module.exports = {
  purge: {
    enabled: true,
    content: [
      './src/views/**/*.ejs'
    ]
  },
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      fontFamily: {
        'quicksand': ['"Quicksand"', 'sans-serif']
      },
      colors: {
        orange: colors.orange
      },
      zIndex: {
        '-10': '-10'
      },
      backgroundImage: {
	'triangles-orange': "url('./images/triangles-orange.png')",
        //'triangles-orange': "url('https://ucarecdn.com/96762648-670c-4143-8291-d0fefce42668/1')",

         'triangles-gray': "url('./images/triangles-gray.png')",
        //'triangles-gray': "url('https://ucarecdn.com/b37d9de1-7641-40f6-9daf-c67c765e1a6a/1')",
        
         'triangles-gray-mirrored': "url('./images/triangles-gray-mirrored.png')"
        //'triangles-gray-mirrored': "url('https://ucarecdn.com/fc93fca7-ff73-40e5-84cb-0b6b25253b96/1')"
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
