# Gestor de Jugadores de Fútbol

Una aplicación web completa para gestionar jugadores, armar alineaciones y visualizar estadísticas. Los datos se guardan en la nube y se sincronizan entre dispositivos.

## 🚀 Características

- ✅ **Tabla de jugadores** con ID, nombre, país, equipo, posición y foto
- ✅ **Colores por posición** (Arquero violeta, Defensa azul, Medio campo verde, Delantero rojo, Técnico dorado)
- ✅ **Estadísticas**: edad promedio, países que juegan, equipos
- ✅ **Armar 11 titular**: 5 formaciones diferentes (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2) con fotos de jugadores
- ✅ **Sincronización en la nube**: agrega un jugador en el computador y verlo en el celular al instante
- ✅ **Búsqueda y filtrado** por nombre, equipo, país o ID
- ✅ **Eliminar con confirmación** (alerta de 5 segundos + confirmación)
- ✅ **Explicación del código** integrada en la página

## 📋 Requisitos

Necesitas tener instalado:
- **Node.js 18+** (descarga desde [nodejs.org](https://nodejs.org))
- **Git** (descarga desde [git-scm.com](https://git-scm.com))
- **Visual Studio Code** (descarga desde [code.visualstudio.com](https://code.visualstudio.com))

## 🔧 Instalación en tu computador

### Paso 1: Descargar el proyecto

1. Descarga el archivo ZIP del proyecto
2. Extrae la carpeta en un lugar de tu computador (ej: `Escritorio/gestor-jugadores`)

### Paso 2: Abrir en Visual Studio Code

1. Abre **Visual Studio Code**
2. Ve a **Archivo → Abrir carpeta** (o `Ctrl+K Ctrl+O`)
3. Selecciona la carpeta que extrajiste
4. Espera a que VS Code cargue el proyecto

### Paso 3: Instalar dependencias

1. Abre la **Terminal** en VS Code:
   - Windows/Linux: `Ctrl + ñ` (o Ctrl+Backtick)
   - Mac: `Cmd + ñ` (o Cmd+Backtick)

2. Escribe este comando y presiona Enter:
   ```bash
   npm install
   ```

   O si tienes **pnpm** instalado:
   ```bash
   pnpm install
   ```

3. Espera a que termine (puede tardar 1-2 minutos)

### Paso 4: Iniciar el servidor

Escribe este comando en la terminal:
```bash
npm run dev
```

O con pnpm:
```bash
pnpm dev
```

Verás algo como:
```
▲ Next.js 16.0.0
- Local:        http://localhost:3000
```

### Paso 5: Abrir en el navegador

1. Abre tu navegador (Chrome, Firefox, Edge, Safari)
2. Ve a `http://localhost:3000`
3. ¡Ya está funcionando! 🎉

## 📱 Acceder desde el celular en la misma red

Para que tu celular y computador compartan los mismos jugadores:

1. En la terminal donde corre el servidor, busca la línea que dice `Local:` (ej: `http://localhost:3000`)
2. Reemplaza `localhost` con la **IP de tu computador**:
   - **Windows**: abre "Símbolo del sistema" y escribe `ipconfig`, busca "IPv4 Address" (ej: `192.168.1.X`)
   - **Mac/Linux**: abre la terminal y escribe `ifconfig`, busca "inet" (ej: `192.168.1.X`)

3. En tu celular, abre el navegador y ve a `http://192.168.1.X:3000` (reemplaza X con tu IP)
4. Agrega un jugador en el computador → aparecerá en el celular al instante ✅

## 🗄️ Base de datos

Los datos se guardan automáticamente en **Neon** (base de datos en la nube). No necesitas configurar nada — todo está listo.

Si quieres resetear los datos:
1. En VS Code, abre la terminal integrada
2. Los datos se pueden borrar manualmente si necesitas empezar de cero

## 🎮 Cómo usar la app

### Agregar jugador
1. Rellena el formulario "Agregar nuevo jugador"
2. Campo foto: puedes pegar una URL o subir una imagen
3. Presiona "Añadir jugador"

### Editar jugador
1. En la tabla, presiona el botón de **Editar** (lápiz)
2. Cambia los datos que quieras
3. Presiona "Guardar cambios"

### Eliminar jugador
1. En la tabla, presiona el botón de **Eliminar** (basura)
2. Aparecerá una alerta de 5 segundos
3. Confirma si quieres eliminar (segunda alerta)

### Armar alineación (11 titular)
1. Baja a la sección "Arma tu 11"
2. Elige una formación (4-4-2, 4-3-3, etc.)
3. Presiona "Agregar jugador" en cada posición
4. Elige el jugador que quieres en esa posición
5. La cancha se llenará con las fotos de tus jugadores

## 📊 Estadísticas

La página muestra automáticamente:
- **Jugadores**: cuántos tienes en total
- **Edad promedio**: promedio de edad de todos
- **Países**: país más común entre tus jugadores
- **Equipos**: equipo más representado

## 🧠 Explicación del código

Aquí está la explicación de cómo funciona cada parte del proyecto, con ejemplos de código.

## ❌ Solucionar problemas

### "npm: comando no encontido"
- Node.js no está instalado. Descárgalo desde [nodejs.org](https://nodejs.org) e instálalo

### "Puerto 3000 en uso"
- Otro programa está usando el puerto. Ciérralo o usa un puerto diferente:
  ```bash
  npm run dev -- -p 3001
  ```

### "No me carga la página"
- Espera 10 segundos (Next.js está compilando)
- Recarga la página (Ctrl+R o Cmd+R)
- Verifica que en la terminal diga "✓ Compiled"

### "Los datos no sincronizan entre dispositivos"
- Asegúrate de que ambos dispositivos estén en la misma red WiFi
- Usa la IP correcta de tu computador (mira el paso "Acceder desde el celular")

## 🛠️ Comandos útiles

```bash
# Iniciar servidor
npm run dev

# Parar servidor
Presiona Ctrl+C en la terminal

# Instalar nuevas dependencias
npm install nombre-paquete

# Ver la estructura del proyecto
npm run build
```

## 📚 Tecnologías usadas

- **Next.js 16**: framework web
- **React**: librería UI
- **Tailwind CSS**: estilos
- **Neon + Drizzle ORM**: base de datos
- **shadcn/ui**: componentes UI bonitos

## 📞 Ayuda

Si algo no funciona:
1. Verifica que Node.js esté instalado: `node --version`
2. Verifica que el servidor está corriendo (debería decir `✓ Compiled`)
3. Abre la consola del navegador (F12) para ver errores
4. Recarga la página (Ctrl+R o Cmd+R)

---

**¡Que disfrutes del gestor de jugadores! ⚽**
