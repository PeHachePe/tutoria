import { type ExerciseFixture, lines, type SampleCode } from './exercise-fixture';

/**
 * More exercises of client-side web development (2.5c), numbers 18 to 30 of the seed: with 9 and
 * 10, the subject has 15. Pure functions, as the code runs without a page: what a form, a URL or a
 * shop of the browser needs. Each one comes with its sample code: a typical mistake and a solution.
 */
export const WEB_EXERCISE_FIXTURES: readonly (ExerciseFixture & { readonly code: SampleCode })[] = [
  {
    title: 'Convertir un título en slug',
    difficulty: 'medium',
    topics: ['Cadenas', 'URL amigables'],
    functionName: 'slugify',
    statement:
      'Escribe una función `slugify` que convierta un título en la parte de una URL: en minúsculas, sin espacios al principio ni al final y con las palabras separadas por un solo guion (`-`), aunque entre ellas haya varios espacios. Un título vacío da un texto vacío.',
    translations: {
      en: {
        title: 'Turn a title into a slug',
        topics: ['Strings', 'friendly URLs'],
        statement:
          'Write a function `slugify` that turns a title into the part of a URL: in lower case, without spaces at the start or the end, and with the words separated by a single hyphen (`-`), even if there are several spaces between them. An empty title gives an empty text.',
      },
      ca: {
        title: 'Convertir un títol en slug',
        topics: ['Cadenes', 'URL amigables'],
        statement:
          "Escriu una funció `slugify` que converteixi un títol en la part d'una URL: en minúscules, sense espais al principi ni al final i amb les paraules separades per un sol guió (`-`), encara que entre elles hi hagi diversos espais. Un títol buit dona un text buit.",
      },
    },
    visible: [
      [['Hola Mundo'], 'hola-mundo'],
      [['  Mi   Blog  '], 'mi-blog'],
      [['JS'], 'js'],
    ],
    hidden: [
      [['Tema 1 de 3'], 'tema-1-de-3'],
      [[''], ''],
    ],
    code: {
      partial: lines(
        'function slugify(title) {',
        "  return title.toLowerCase().replaceAll(' ', '-');",
        '}',
      ),
      solved: lines(
        'function slugify(title) {',
        "  return title.trim().toLowerCase().split(/\\s+/).filter(Boolean).join('-');",
        '}',
      ),
    },
  },
  {
    title: 'Leer un parámetro de la URL',
    difficulty: 'advanced',
    topics: ['URL', 'cadenas de consulta', 'decodificación'],
    functionName: 'getQueryParam',
    statement:
      'Escribe una función `getQueryParam` que reciba una URL y el nombre de un parámetro, y devuelva su valor decodificado con `decodeURIComponent` (`hola%20mundo` es `hola mundo`). Si el parámetro aparece varias veces, cuenta el primero. Si no aparece, devuelve `null`.',
    translations: {
      en: {
        title: 'Read a parameter of the URL',
        topics: ['URL', 'query strings', 'decoding'],
        statement:
          'Write a function `getQueryParam` that takes a URL and the name of a parameter, and returns its value decoded with `decodeURIComponent` (`hola%20mundo` is `hola mundo`). If the parameter appears several times, the first one counts. If it does not appear, it returns `null`.',
      },
      ca: {
        title: "Llegir un paràmetre de l'URL",
        topics: ['URL', 'cadenes de consulta', 'descodificació'],
        statement:
          "Escriu una funció `getQueryParam` que rebi una URL i el nom d'un paràmetre, i retorni el seu valor descodificat amb `decodeURIComponent` (`hola%20mundo` és `hola mundo`). Si el paràmetre apareix diverses vegades, compta el primer. Si no hi apareix, retorna `null`.",
      },
    },
    visible: [
      [['https://tienda.test/buscar?q=gatos&page=2', 'page'], '2'],
      [['https://tienda.test/buscar?q=hola%20mundo', 'q'], 'hola mundo'],
      [['https://tienda.test/', 'q'], null],
    ],
    hidden: [
      [['https://tienda.test/?a=1&b=2', 'c'], null],
      [['https://tienda.test/?q=1&q=2', 'q'], '1'],
    ],
    code: {
      partial: lines(
        'function getQueryParam(url, name) {',
        "  const query = url.split('?')[1] ?? '';",
        "  const pair = query.split('&').find((part) => part.startsWith(name + '='));",
        "  return pair ? pair.split('=')[1] : null;",
        '}',
      ),
      solved: lines(
        'function getQueryParam(url, name) {',
        "  const query = url.split('?')[1] ?? '';",
        "  for (const pair of query.split('&')) {",
        "    const [key, value = ''] = pair.split('=');",
        '    if (key === name) return decodeURIComponent(value);',
        '  }',
        '  return null;',
        '}',
      ),
    },
  },
  {
    title: 'Precio con formato',
    difficulty: 'initial',
    topics: ['Números', 'formato de salida'],
    functionName: 'formatPrice',
    statement:
      'Escribe una función `formatPrice` que reciba un importe y lo devuelva como texto con dos decimales, coma decimal y el símbolo del euro detrás, separado por un espacio: `12.5` es `"12,50 €"`. Sin separador de miles.',
    translations: {
      en: {
        title: 'Formatted price',
        topics: ['Numbers', 'output format'],
        statement:
          'Write a function `formatPrice` that takes an amount and returns it as text with two decimals, a decimal comma and the euro sign after it, separated by a space: `12.5` is `"12,50 €"`. No thousands separator.',
      },
      ca: {
        title: 'Preu amb format',
        topics: ['Nombres', 'format de sortida'],
        statement:
          'Escriu una funció `formatPrice` que rebi un import i el retorni com a text amb dos decimals, coma decimal i el símbol de l\'euro darrere, separat per un espai: `12.5` és `"12,50 €"`. Sense separador de milers.',
      },
    },
    visible: [
      [[12.5], '12,50 €'],
      [[3], '3,00 €'],
      [[0], '0,00 €'],
    ],
    hidden: [
      [[1234.567], '1234,57 €'],
      [[0.1], '0,10 €'],
    ],
    code: {
      partial: lines('function formatPrice(amount) {', "  return amount + ' €';", '}'),
      solved: lines(
        'function formatPrice(amount) {',
        "  return amount.toFixed(2).replace('.', ',') + ' €';",
        '}',
      ),
    },
  },
  {
    title: 'Contraseña segura',
    difficulty: 'medium',
    topics: ['Validación de formularios', 'expresiones regulares'],
    functionName: 'isStrongPassword',
    statement:
      'Escribe una función `isStrongPassword` que reciba una contraseña y devuelva `true` si es segura: al menos 8 caracteres, al menos una cifra y al menos una letra mayúscula. Si no, devuelve `false`.',
    translations: {
      en: {
        title: 'Strong password',
        topics: ['Form validation', 'regular expressions'],
        statement:
          'Write a function `isStrongPassword` that takes a password and returns `true` if it is strong: at least 8 characters, at least one digit and at least one upper case letter. If not, it returns `false`.',
      },
      ca: {
        title: 'Contrasenya segura',
        topics: ['Validació de formularis', 'expressions regulars'],
        statement:
          'Escriu una funció `isStrongPassword` que rebi una contrasenya i retorni `true` si és segura: almenys 8 caràcters, almenys una xifra i almenys una lletra majúscula. Si no, retorna `false`.',
      },
    },
    visible: [
      [['Secreto123'], true],
      [['secreto123'], false],
      [['Corta1'], false],
      [['SinNumeros'], false],
    ],
    hidden: [
      [['ABCDEFG1'], true],
      [[''], false],
    ],
    code: {
      partial: lines(
        'function isStrongPassword(password) {',
        '  return password.length >= 8;',
        '}',
      ),
      solved: lines(
        'function isStrongPassword(password) {',
        '  return password.length >= 8 && /\\d/.test(password) && /[A-Z]/.test(password);',
        '}',
      ),
    },
  },
  {
    title: 'Contar las palabras de un texto',
    difficulty: 'initial',
    topics: ['Cadenas', 'casos límite'],
    functionName: 'countWords',
    statement:
      'Escribe una función `countWords` que reciba un texto y devuelva cuántas palabras tiene. Las palabras están separadas por uno o varios espacios, y puede haber espacios al principio y al final. Un texto vacío o solo con espacios tiene 0 palabras.',
    translations: {
      en: {
        title: 'Count the words of a text',
        topics: ['Strings', 'edge cases'],
        statement:
          'Write a function `countWords` that takes a text and returns how many words it has. The words are separated by one or more spaces, and there can be spaces at the start and the end. An empty text, or one with only spaces, has 0 words.',
      },
      ca: {
        title: "Comptar les paraules d'un text",
        topics: ['Cadenes', 'casos límit'],
        statement:
          'Escriu una funció `countWords` que rebi un text i retorni quantes paraules té. Les paraules estan separades per un o diversos espais, i hi pot haver espais al principi i al final. Un text buit o només amb espais té 0 paraules.',
      },
    },
    visible: [
      [['hola mundo'], 2],
      [['  uno  dos tres '], 3],
      [[''], 0],
    ],
    hidden: [
      [['palabra'], 1],
      [['   '], 0],
    ],
    code: {
      partial: lines('function countWords(text) {', "  return text.split(' ').length;", '}'),
      solved: lines(
        'function countWords(text) {',
        "  return text.split(' ').filter((word) => word !== '').length;",
        '}',
      ),
    },
  },
  {
    title: 'Iniciales de un nombre',
    difficulty: 'initial',
    topics: ['Cadenas', 'vectores'],
    functionName: 'getInitials',
    statement:
      'Escribe una función `getInitials` que reciba un nombre completo y devuelva sus iniciales en mayúscula, juntas: `"Lucía Martín Gómez"` es `"LMG"`. Puede haber varios espacios entre las palabras o en los extremos. Un nombre vacío da un texto vacío.',
    translations: {
      en: {
        title: 'Initials of a name',
        topics: ['Strings', 'arrays'],
        statement:
          'Write a function `getInitials` that takes a full name and returns its initials in upper case, together: `"Lucía Martín Gómez"` is `"LMG"`. There can be several spaces between the words or at the ends. An empty name gives an empty text.',
      },
      ca: {
        title: "Inicials d'un nom",
        topics: ['Cadenes', 'vectors'],
        statement:
          'Escriu una funció `getInitials` que rebi un nom complet i retorni les seves inicials en majúscula, juntes: `"Lucía Martín Gómez"` és `"LMG"`. Hi pot haver diversos espais entre les paraules o als extrems. Un nom buit dona un text buit.',
      },
    },
    visible: [
      [['Lucía Martín Gómez'], 'LMG'],
      [['ana'], 'A'],
      [[''], ''],
    ],
    hidden: [
      [['  hugo   sánchez '], 'HS'],
      [['Aya Benali'], 'AB'],
    ],
    code: {
      partial: lines(
        'function getInitials(fullName) {',
        "  return fullName.split(' ').map((word) => word[0]).join('');",
        '}',
      ),
      solved: lines(
        'function getInitials(fullName) {',
        '  return fullName',
        '    .trim()',
        '    .split(/\\s+/)',
        '    .filter(Boolean)',
        '    .map((word) => word[0].toUpperCase())',
        "    .join('');",
        '}',
      ),
    },
  },
  {
    title: 'Recortar un texto largo',
    difficulty: 'medium',
    topics: ['Cadenas', 'condicionales'],
    functionName: 'truncate',
    statement:
      'Escribe una función `truncate` que reciba un texto y una longitud máxima. Si el texto es más largo, devuelve sus primeros caracteres hasta esa longitud seguidos de `…`; si no, lo devuelve tal cual.',
    translations: {
      en: {
        title: 'Shorten a long text',
        topics: ['Strings', 'conditionals'],
        statement:
          'Write a function `truncate` that takes a text and a maximum length. If the text is longer, it returns its first characters up to that length followed by `…`; if not, it returns it as it is.',
      },
      ca: {
        title: 'Retallar un text llarg',
        topics: ['Cadenes', 'condicionals'],
        statement:
          'Escriu una funció `truncate` que rebi un text i una longitud màxima. Si el text és més llarg, retorna els seus primers caràcters fins a aquesta longitud seguits de `…`; si no, el retorna tal qual.',
      },
    },
    visible: [
      [['Hola mundo', 4], 'Hola…'],
      [['Hola', 4], 'Hola'],
      [['', 3], ''],
    ],
    hidden: [
      [['abcdef', 0], '…'],
      [['abc', 5], 'abc'],
    ],
    code: {
      partial: lines('function truncate(text, max) {', "  return text.slice(0, max) + '…';", '}'),
      solved: lines(
        'function truncate(text, max) {',
        "  return text.length > max ? text.slice(0, max) + '…' : text;",
        '}',
      ),
    },
  },
  {
    title: 'Fecha en formato español',
    difficulty: 'initial',
    topics: ['Cadenas', 'fechas'],
    functionName: 'formatDate',
    statement:
      'Escribe una función `formatDate` que reciba una fecha como `"2026-11-11"` (año, mes y día) y la devuelva como `"11/11/2026"` (día, mes y año), con los ceros a la izquierda que ya trae.',
    translations: {
      en: {
        title: 'Date in Spanish format',
        topics: ['Strings', 'dates'],
        statement:
          'Write a function `formatDate` that takes a date such as `"2026-11-11"` (year, month and day) and returns it as `"11/11/2026"` (day, month and year), with the leading zeros it already has.',
      },
      ca: {
        title: 'Data en format espanyol',
        topics: ['Cadenes', 'dates'],
        statement:
          'Escriu una funció `formatDate` que rebi una data com `"2026-11-11"` (any, mes i dia) i la retorni com `"11/11/2026"` (dia, mes i any), amb els zeros a l\'esquerra que ja porta.',
      },
    },
    visible: [
      [['2026-11-11'], '11/11/2026'],
      [['2026-01-05'], '05/01/2026'],
      [['1999-12-31'], '31/12/1999'],
    ],
    hidden: [
      [['2000-02-29'], '29/02/2000'],
      [['2026-10-01'], '01/10/2026'],
    ],
    code: {
      partial: lines(
        'function formatDate(isoDate) {',
        "  return isoDate.split('-').join('/');",
        '}',
      ),
      solved: lines(
        'function formatDate(isoDate) {',
        "  return isoDate.split('-').reverse().join('/');",
        '}',
      ),
    },
  },
  {
    title: 'Validar un código postal',
    difficulty: 'advanced',
    topics: ['Validación de formularios', 'expresiones regulares'],
    functionName: 'isValidPostalCode',
    statement:
      'Escribe una función `isValidPostalCode` que reciba un texto y devuelva `true` si es un código postal español válido: exactamente cinco cifras, y las dos primeras (la provincia) entre 01 y 52. Si no, devuelve `false`.',
    translations: {
      en: {
        title: 'Validate a postal code',
        topics: ['Form validation', 'regular expressions'],
        statement:
          'Write a function `isValidPostalCode` that takes a text and returns `true` if it is a valid Spanish postal code: exactly five digits, and the first two (the province) between 01 and 52. If not, it returns `false`.',
      },
      ca: {
        title: 'Validar un codi postal',
        topics: ['Validació de formularis', 'expressions regulars'],
        statement:
          'Escriu una funció `isValidPostalCode` que rebi un text i retorni `true` si és un codi postal espanyol vàlid: exactament cinc xifres, i les dues primeres (la província) entre 01 i 52. Si no, retorna `false`.',
      },
    },
    visible: [
      [['08001'], true],
      [['28013'], true],
      [['1234'], false],
      [['99000'], false],
    ],
    hidden: [
      [['00123'], false],
      [['5200A'], false],
    ],
    code: {
      partial: lines('function isValidPostalCode(code) {', '  return code.length === 5;', '}'),
      solved: lines(
        'function isValidPostalCode(code) {',
        '  if (!/^\\d{5}$/.test(code)) return false;',
        '  const province = Number(code.slice(0, 2));',
        '  return province >= 1 && province <= 52;',
        '}',
      ),
    },
  },
  {
    title: 'Color RGB en hexadecimal',
    difficulty: 'medium',
    topics: ['Números', 'bases', 'formato de salida'],
    functionName: 'rgbToHex',
    statement:
      'Escribe una función `rgbToHex` que reciba los tres componentes de un color (rojo, verde y azul, de 0 a 255) y devuelva el color en hexadecimal para CSS: `#` y dos cifras en minúscula por componente, con un cero delante si hace falta. `(255, 0, 0)` es `"#ff0000"`.',
    translations: {
      en: {
        title: 'RGB colour in hexadecimal',
        topics: ['Numbers', 'bases', 'output format'],
        statement:
          'Write a function `rgbToHex` that takes the three components of a colour (red, green and blue, from 0 to 255) and returns the colour in hexadecimal for CSS: `#` and two lower case digits per component, with a leading zero if needed. `(255, 0, 0)` is `"#ff0000"`.',
      },
      ca: {
        title: 'Color RGB en hexadecimal',
        topics: ['Nombres', 'bases', 'format de sortida'],
        statement:
          'Escriu una funció `rgbToHex` que rebi els tres components d\'un color (vermell, verd i blau, de 0 a 255) i retorni el color en hexadecimal per a CSS: `#` i dues xifres en minúscula per component, amb un zero davant si cal. `(255, 0, 0)` és `"#ff0000"`.',
      },
    },
    visible: [
      [[255, 0, 0], '#ff0000'],
      [[0, 128, 255], '#0080ff'],
      [[0, 0, 0], '#000000'],
    ],
    hidden: [
      [[255, 255, 255], '#ffffff'],
      [[1, 2, 3], '#010203'],
    ],
    code: {
      partial: lines(
        'function rgbToHex(red, green, blue) {',
        "  return '#' + [red, green, blue].map((value) => value.toString(16)).join('');",
        '}',
      ),
      solved: lines(
        'function rgbToHex(red, green, blue) {',
        '  return (',
        "    '#' + [red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')",
        '  );',
        '}',
      ),
    },
  },
  {
    title: 'Construir una URL',
    difficulty: 'medium',
    topics: ['URL', 'cadenas'],
    functionName: 'buildUrl',
    statement:
      'Escribe una función `buildUrl` que reciba la dirección base de una web y una ruta, y devuelva la URL completa con una sola barra (`/`) entre las dos, aunque la base acabe en barra o la ruta empiece por ella.',
    translations: {
      en: {
        title: 'Build a URL',
        topics: ['URL', 'strings'],
        statement:
          'Write a function `buildUrl` that takes the base address of a website and a path, and returns the full URL with a single slash (`/`) between them, even if the base ends in a slash or the path starts with one.',
      },
      ca: {
        title: 'Construir una URL',
        topics: ['URL', 'cadenes'],
        statement:
          "Escriu una funció `buildUrl` que rebi l'adreça base d'un web i una ruta, i retorni l'URL completa amb una sola barra (`/`) entre totes dues, encara que la base acabi en barra o la ruta hi comenci.",
      },
    },
    visible: [
      [['https://tutoria.test', 'ejercicios'], 'https://tutoria.test/ejercicios'],
      [['https://tutoria.test/', '/ejercicios'], 'https://tutoria.test/ejercicios'],
      [['https://tutoria.test/', 'a/b'], 'https://tutoria.test/a/b'],
    ],
    hidden: [
      [['http://x.test', ''], 'http://x.test/'],
      [['http://x.test//', '/y/'], 'http://x.test/y/'],
    ],
    code: {
      partial: lines('function buildUrl(base, path) {', "  return base + '/' + path;", '}'),
      solved: lines(
        'function buildUrl(base, path) {',
        "  return base.replace(/\\/+$/, '') + '/' + path.replace(/^\\/+/, '');",
        '}',
      ),
    },
  },
  {
    title: 'Productos de una categoría',
    difficulty: 'medium',
    topics: ['Objetos', 'filtrar vectores'],
    functionName: 'namesInCategory',
    statement:
      'Escribe una función `namesInCategory` que reciba un vector de productos, cada uno con `name` y `category`, y una categoría, y devuelva los nombres de los productos de esa categoría, en su orden. Si no hay ninguno, devuelve un vector vacío.',
    translations: {
      en: {
        title: 'Products of a category',
        topics: ['Objects', 'filtering arrays'],
        statement:
          'Write a function `namesInCategory` that takes an array of products, each with `name` and `category`, and a category, and returns the names of the products of that category, in their order. If there are none, it returns an empty array.',
      },
      ca: {
        title: "Productes d'una categoria",
        topics: ['Objectes', 'filtrar vectors'],
        statement:
          "Escriu una funció `namesInCategory` que rebi un vector de productes, cadascun amb `name` i `category`, i una categoria, i retorni els noms dels productes d'aquesta categoria, en el seu ordre. Si no n'hi ha cap, retorna un vector buit.",
      },
    },
    visible: [
      [
        [
          [
            { name: 'Teclado', category: 'pc' },
            { name: 'Ratón', category: 'pc' },
            { name: 'Silla', category: 'hogar' },
          ],
          'pc',
        ],
        ['Teclado', 'Ratón'],
      ],
      [[[{ name: 'Silla', category: 'hogar' }], 'hogar'], ['Silla']],
      [[[], 'pc'], []],
    ],
    hidden: [
      [[[{ name: 'Silla', category: 'hogar' }], 'jardín'], []],
      [
        [
          [
            { name: 'Lámpara', category: 'hogar' },
            { name: 'Monitor', category: 'pc' },
            { name: 'Mesa', category: 'hogar' },
          ],
          'hogar',
        ],
        ['Lámpara', 'Mesa'],
      ],
    ],
    code: {
      partial: lines(
        'function namesInCategory(products, category) {',
        '  return products.filter((product) => product.category === category);',
        '}',
      ),
      solved: lines(
        'function namesInCategory(products, category) {',
        '  return products',
        '    .filter((product) => product.category === category)',
        '    .map((product) => product.name);',
        '}',
      ),
    },
  },
  {
    title: 'Total del carrito',
    difficulty: 'advanced',
    topics: ['Objetos', 'acumulador', 'redondeo'],
    functionName: 'cartTotal',
    statement:
      'Escribe una función `cartTotal` que reciba el carrito de una tienda, un vector de líneas con `price` y `quantity`, y devuelva el total (precio por cantidad de cada línea) redondeado a dos decimales como número. Un carrito vacío vale 0.',
    translations: {
      en: {
        title: 'Cart total',
        topics: ['Objects', 'accumulator', 'rounding'],
        statement:
          'Write a function `cartTotal` that takes the cart of a shop, an array of lines with `price` and `quantity`, and returns the total (price times quantity of each line) rounded to two decimals as a number. An empty cart is worth 0.',
      },
      ca: {
        title: 'Total del carretó',
        topics: ['Objectes', 'acumulador', 'arrodoniment'],
        statement:
          "Escriu una funció `cartTotal` que rebi el carretó d'una botiga, un vector de línies amb `price` i `quantity`, i retorni el total (preu per quantitat de cada línia) arrodonit a dos decimals com a nombre. Un carretó buit val 0.",
      },
    },
    visible: [
      [[[{ price: 2.5, quantity: 2 }]], 5],
      [
        [
          [
            { price: 1.2, quantity: 3 },
            { price: 0.5, quantity: 1 },
          ],
        ],
        4.1,
      ],
      [[[]], 0],
    ],
    hidden: [
      [[[{ price: 9.99, quantity: 3 }]], 29.97],
      [[[{ price: 0.1, quantity: 3 }]], 0.3],
    ],
    code: {
      partial: lines(
        'function cartTotal(lines) {',
        '  let total = 0;',
        '  for (const line of lines) total += line.price * line.quantity;',
        '  return total;',
        '}',
      ),
      solved: lines(
        'function cartTotal(lines) {',
        '  let total = 0;',
        '  for (const line of lines) total += line.price * line.quantity;',
        '  return Math.round(total * 100) / 100;',
        '}',
      ),
    },
  },
];
