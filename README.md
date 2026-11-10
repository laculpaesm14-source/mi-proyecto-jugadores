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
- **Node.js 22+** (descarga desde [nodejs.org](https://nodejs.org))
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

### Paso 4: Conectar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/) o abre uno existente.
2. En **SQL Editor**, ejecuta todo el contenido de [`supabase/schema.sql`](./supabase/schema.sql). Esto crea las tablas `players` y `user_lineups`, activa RLS y limita cada cuenta a sus propios registros. Si ya ejecutaste una versión anterior, vuelve a ejecutar el archivo completo para crear `user_lineups`; las instrucciones son repetibles y no borran los jugadores existentes.
3. En **Project Settings → API**, copia la **Project URL** y la **Publishable key**.
4. Copia `.env.example` como `.env.local` en la raíz y completa:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-clave-publicable
   ```

   La clave publicable (o la antigua `anon`) se puede usar en el navegador porque el acceso está protegido por las políticas RLS. **Nunca pongas una `service_role` o secret key en variables `NEXT_PUBLIC_` ni en el navegador.**
5. En **Authentication → URL Configuration**, configura **Site URL** y añade a **Redirect URLs** la dirección de la app (por ejemplo, `http://localhost:3000/**` para desarrollo y el dominio desplegado). Activa el proveedor Email. Supabase debe permitir la URL a la que volverá el enlace de recuperación.

### Paso 5: Iniciar el servidor

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

### Paso 6: Abrir en el navegador

1. Abre tu navegador (Chrome, Firefox, Edge, Safari)
2. Ve a `http://localhost:3000`
3. ¡Ya está funcionando! 🎉

## 📱 Sincronizar entre dispositivos

Despliega la aplicación y configura en el hosting las mismas variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Inicia sesión con la misma cuenta en cada dispositivo; los cambios se sincronizan en tiempo real. Para desarrollo local, ambos dispositivos deben poder abrir la dirección de tu computador.

## 🗄️ Base de datos

Los registros se guardan en **Supabase**. Cada cuenta tiene su propia lista y las políticas de seguridad de la tabla impiden que una cuenta lea o modifique la lista de otra.

Los jugadores y la alineación se consultan y guardan directamente en Supabase. La app no usa almacenamiento local del navegador ni carga jugadores de ejemplo automáticamente. Para cargar los datos entregados por el profesor, inicia sesión y usa **Archivos de jugadores → Importar JSON o TXT** para seleccionar manualmente `jugadores_data_4.txt`. El importador acepta una lista JSON (incluida una lista dentro de `players`, `jugadores` o `data`) con campos en inglés o español, como `id`/`identificacion`, `name`/`nombre`, `age`/`edad`, `position`/`posicion`, `team`/`equipo` y `nationality`/`nacionalidad`. Los IDs repetidos dentro del archivo se consolidan y una importación repetida actualiza el registro existente en Supabase en lugar de crear otro. Descargar o visualizar JSON solo exporta/muestra una copia de los registros que ya están en Supabase; no guarda una base de datos en el navegador.

Para crear una cuenta, selecciona **Crear cuenta** en la pantalla de inicio. Si Supabase tiene activada la confirmación por correo, revisa tu bandeja de entrada antes de iniciar sesión.

Si olvidas la contraseña, selecciona **¿Olvidaste tu contraseña?** en el inicio de sesión. Abre el enlace que llegue por correo y establece una contraseña nueva de 12 a 64 caracteres.

## 🎮 Cómo usar la app

### Agregar jugador
1. Rellena el formulario "Agregar nuevo jugador"
2. Campo foto: puedes pegar una URL o subir una imagen
3. Presiona "Añadir jugador"

### Importar los datos de la evaluación
1. Inicia sesión en la aplicación.
2. Baja a **Archivos de jugadores** y pulsa **Importar JSON o TXT**.
3. Selecciona el archivo `jugadores_data_4.txt` que te entregó el profesor.
4. Espera el mensaje de confirmación. Si el archivo tiene datos incorrectos, la app mostrará el registro que debes revisar.

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
- **Supabase**: base de datos, autenticación y sincronización en tiempo real
- **shadcn/ui**: componentes UI bonitos

## 📞 Ayuda

Si algo no funciona:
1. Verifica que Node.js esté instalado: `node --version`
2. Verifica que el servidor está corriendo (debería decir `✓ Compiled`)
3. Abre la consola del navegador (F12) para ver errores
4. Recarga la página (Ctrl+R o Cmd+R)

---

**¡Que disfrutes del gestor de jugadores! ⚽**
