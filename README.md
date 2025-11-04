# HyperScape Assets Server

Asset management server for the HyperScape project with authentication, volume support, and Railway deployment.

## Features

- 🔐 **Password-protected dashboard** - Session-based authentication
- 💾 **Persistent storage** - Volume support for uploads and backups
- 🚀 **Railway ready** - One-click deployment with volume mounting
- 📦 **Asset management** - Upload, organize, and validate 3D models, audio, and manifests
- 🔍 **Asset validation** - Verify manifest references
- 📊 **Real-time dashboard** - Web-based file management with preview
- 🎨 **Media previews** - 3D model viewer, audio player, image viewer

## Quick Start

### Local Development

1. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env and set ADMIN_USERNAME and ADMIN_PASSWORD
   ```

2. **Start server:**
   ```bash
   bun start
   ```

3. **Access dashboard:**
   - Open http://localhost:3000/dashboard
   - Login with credentials from .env

📖 **Full guide:** [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)

### Railway Deployment

1. **Add volume at `/data`** (5GB minimum)
2. **Set environment variables** in Railway dashboard:
   ```
   HOST=0.0.0.0
   DATA_DIR=/data
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-strong-password
   ```
   **⚠️ IMPORTANT:** NO quotes around values!

3. **Deploy** and verify:
   - Check logs show "Authentication ENABLED"
   - Visit `/dashboard` - should redirect to login

📖 **Full guide:** [RAILWAY_SETUP.md](./RAILWAY_SETUP.md)

## Common Issues

### "Can access dashboard without login"

**On Railway:**
- ✅ Verify `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set (Variables tab)
- ✅ NO quotes around values: `ADMIN_USERNAME=admin` not `"admin"`
- ✅ Check logs show "Authentication ENABLED"
- ✅ Try redeploying after setting variables

**Locally:**
- ✅ Use `bun start` not `bun run server.js`
- ✅ Verify `.env` file exists with credentials
- ✅ Check logs show "Authentication ENABLED"

### "Files disappear after redeployment"

- ✅ Volume must be mounted at `/data`
- ✅ `DATA_DIR=/data` must be set
- ✅ Add volume BEFORE first deployment

## Documentation

- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) - Local development setup and troubleshooting
- [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) - Step-by-step Railway deployment guide

## Architecture

- **Server:** Bun.js native HTTP server
- **Authentication:** Session-based with HttpOnly cookies, SHA-256 password hashing
- **Storage:** Hybrid approach - production assets in git, dynamic content in volume
- **Security:** Rate limiting (5 attempts/15min), constant-time password comparison

## Environment Variables

### Required (Railway)

```bash
HOST=0.0.0.0                    # Listen on all interfaces
DATA_DIR=/data                  # Volume mount path
ADMIN_USERNAME=admin            # Admin username (no quotes!)
ADMIN_PASSWORD=strong-password  # Admin password (no quotes!)
```

### Optional

```bash
SESSION_DURATION_HOURS=24       # Session expiration (default: 24)
CORS_ORIGINS=*                  # CORS origins (comma-separated)
MAX_FILE_SIZE=104857600         # Max upload size in bytes (default: 100MB)
```

## API Endpoints

### Public (No Auth Required)

- `GET /api/health` - Health check
- `GET /api/auth/status` - Authentication status
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Protected (Authentication Required)

- `GET /api/files` - List all files
- `POST /api/upload` - Upload files
- `DELETE /api/delete/:path` - Delete file
- `POST /api/rename` - Rename file
- `GET /api/validate-references` - Validate asset references
- And more... (see dashboard for full API)

## Development

```bash
bun start          # Start with auth enabled
bun run dev        # Start with auto-reload
```

## Deployment Checklist

- [ ] Volume added at `/data`
- [ ] Environment variables set (NO quotes)
- [ ] Logs show "Authentication ENABLED"
- [ ] `/dashboard` redirects to login
- [ ] Login works with credentials
- [ ] Health check shows `"authEnabled": true`
- [ ] Files persist after redeployment

## Support

- **Issues:** Report bugs or ask questions in GitHub Issues
- **Logs:** Check Railway deployment logs for errors
- **Docs:** See LOCAL_DEVELOPMENT.md and RAILWAY_SETUP.md

## License

MIT
