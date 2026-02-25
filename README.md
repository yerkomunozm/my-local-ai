# Local AI Chat

Aplicación web (React + Vite) para chatear con modelos locales vía Ollama.

## Prerrequisitos

- Node.js 18+ (recomendado: 20+)
- npm 9+
- Ollama instalado y en ejecución
- Al menos 1 modelo descargado en Ollama

## Instalar Ollama

### Windows

1. Descarga e instala desde: <https://ollama.com/download/windows>
2. Abre `PowerShell` o `CMD` y verifica:

```powershell
ollama -v
```

3. Descarga un modelo (ejemplo):

```powershell
ollama pull qwen3:8b
```

Notas:
- En Windows, Ollama normalmente queda corriendo en background después de instalarse.
- API local por defecto: `http://localhost:11434`

### Linux / macOS

Opción rápida (script oficial):

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Luego verifica e instala un modelo:

```bash
ollama -v
ollama pull qwen3:8b
```

Si Ollama no está corriendo, inicia el servidor:

```bash
ollama serve
```

Documentación oficial:
- Linux: <https://docs.ollama.com/linux>
- macOS: <https://docs.ollama.com/macos>

## Ejecutar el proyecto

```bash
npm install
npm run dev
```

La app corre en `http://localhost:8080` (o el puerto que indique Vite).

## Configuración de la app

En Settings de la app:
- `Ollama Server URL`: `http://localhost:11434`
- `Model`: usa uno que tengas instalado, por ejemplo `qwen3:8b`

Puedes listar modelos instalados con:

```bash
ollama list
```

## Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
