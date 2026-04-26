# Bulletproof Journal Backend

Node.js Express API server for the Bulletproof Journal mobile application.

## 🚀 Features

- **RESTful API**: Clean and organized API endpoints
- **SQLite Database**: Lightweight, file-based database with comprehensive schema
- **Security**: Helmet middleware, CORS protection, and input validation
- **Logging**: Morgan HTTP request logging
- **Environment Configuration**: Dotenv for environment variables

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Edit environment variables in `.env`**
   ```env
   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:19006
  MT5_WEBHOOK_SECRET=your-strong-shared-secret
   LOG_LEVEL=info
   ```

5. **Initialize the database**
   ```bash
   npm run init-db
   ```

## 🚀 Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your .env file).

## 📚 API Endpoints

### Journal Entries
- `GET /api/journal` - Get all journal entries (paginated)
- `POST /api/journal` - Create a new journal entry
- `GET /api/journal/:id` - Get a specific journal entry
- `PUT /api/journal/:id` - Update a journal entry
- `DELETE /api/journal/:id` - Delete a journal entry

### Health Check
- `GET /api/health` - API health status

## 🤖 MT5 Auto-Journaling

The backend also exposes MT5 webhook endpoints for automatic trade journaling.

### Webhook Endpoints
- `POST /api/mt5/webhook` - Receive MT5 entry/exit deals
- `POST /api/mt5/check-tickets` - Let the EA skip already-synced deals

### Required Environment Variables
```env
MT5_WEBHOOK_SECRET=your-strong-shared-secret
```

### MT5 Setup Flow
1. Start this backend on Render or locally.
2. Copy the webhook URL shown in the app Settings page.
3. Paste the same `MT5_WEBHOOK_SECRET` into the EA input `InpApiSecret`.
4. Add the backend base URL to MT5 WebRequest allowlist.
5. Attach the EA to one chart only and keep MT5 running.

The current production backend URL is `https://web-journal-2r5u.onrender.com/api`.

## 🗄️ Database Schema

The SQLite database includes the following tables:

### Journal Entries
```sql
- id (Primary Key, Auto Increment)
- title (Not Null)
- content (Not Null)
- mood_rating (1-10, Optional)
- tags (JSON array as text)
- is_private (Boolean, Default: true)
- created_at (Default: Current Timestamp)
- updated_at (Default: Current Timestamp)
```

### Goals
```sql
- id (Primary Key, Auto Increment)
- title (Not Null)
- description
- target_date
- is_completed (Boolean, Default: false)
- priority (1-5, Default: 3)
- created_at, updated_at, completed_at
```

### Habits & Habit Logs
```sql
- Similar structure for habit tracking functionality
```

## 🔒 Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Register/Login**: Users receive a JWT token upon successful authentication
2. **Token Storage**: Mobile app stores token securely using Expo SecureStore
3. **Protected Routes**: Most endpoints require a valid Bearer token in the Authorization header
4. **Token Format**: `Authorization: Bearer <your-jwt-token>`

## 📝 API Usage Examples

### Register a new user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "securepassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "securepassword123"
  }'
```

### Create a journal entry
```bash
curl -X POST http://localhost:3000/api/journal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "title": "My First Entry",
    "content": "Today was a great day...",
    "moodRating": 8,
    "tags": ["happy", "productive"],
    "isPrivate": true
  }'
```

### Get journal entries
```bash
curl -X GET "http://localhost:3000/api/journal?page=1&limit=10" \
  -H "Authorization: Bearer <your-jwt-token>"
```

## 🔧 Project Structure

```
backend/
├── src/
│   ├── routes/          # API route definitions
│   │   ├── auth.js      # Authentication routes
│   │   ├── journal.js   # Journal entry routes
│   │   └── user.js      # User management routes
│   ├── middleware/      # Express middleware
│   │   └── auth.js      # JWT authentication middleware
│   ├── database/        # Database configuration
│   │   ├── connection.js # Database connection utilities
│   │   └── init.js      # Database initialization
│   └── app.js           # Express app configuration
├── data/                # SQLite database files (auto-created)
├── server.js            # Server entry point
├── package.json         # Dependencies and scripts
└── .env                 # Environment variables
```

## 🧪 Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with auto-reload
- `npm run init-db` - Initialize/reset the database
- `npm test` - Run tests (placeholder)

## 🔐 Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Tokens**: Secure token-based authentication
- **CORS Protection**: Configured for specific frontend origins
- **Helmet Middleware**: Security headers
- **Input Validation**: Proper validation for all endpoints
- **SQL Injection Prevention**: Parameterized queries

## 🚨 Error Handling

The API includes comprehensive error handling:

- **Validation Errors**: 400 Bad Request with descriptive messages
- **Authentication Errors**: 401 Unauthorized for invalid tokens
- **Authorization Errors**: 403 Forbidden for insufficient permissions
- **Not Found Errors**: 404 Not Found for missing resources
- **Server Errors**: 500 Internal Server Error with optional stack traces in development

## 📊 Development Tips

1. **Database Reset**: Run `npm run init-db` to reset the database
2. **Logging**: Check console for detailed request logs
3. **Environment**: Set `NODE_ENV=development` for detailed error messages
4. **CORS**: Update `FRONTEND_URL` in .env for different client URLs
5. **JWT Secret**: Always use a strong, unique JWT secret in production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.