# Bulletproof Journal

A secure and feature-rich mobile journal application built with React Native, Node.js, and SQLite.

## 🚀 Features

- **Simple Journal Entries**: Create, read, update, and delete journal entries
- **Mood Tracking**: Rate your mood on a 1-10 scale with each entry
- **Tag System**: Organize entries with customizable tags
- **Privacy Control**: Mark entries as private or public
- **Search Functionality**: Find entries by title or content
- **Cross-Platform**: Works on both iOS and Android devices
- **No Authentication Required**: Simple, immediate access to your journal

## 📁 Project Structure

```
bulletproof-journal/
├── mobile-app/          # React Native mobile application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── screens/     # App screens
│   │   ├── services/    # API services
│   │   ├── context/     # React Context providers
│   │   └── utils/       # Utility functions
│   └── package.json
└── backend/             # Node.js Express server
    ├── src/
    │   ├── routes/      # API routes
    │   ├── controllers/ # Route controllers
    │   ├── models/      # Data models
    │   ├── middleware/  # Express middleware
    │   └── database/    # Database configuration
    ├── data/            # SQLite database files
    └── package.json
```

## 🛠️ Tech Stack

### Backend (API Server)
- **Node.js**: JavaScript runtime
- **Express.js**: Web application framework
- **SQLite**: Lightweight database
- **Helmet**: Security middleware
- **CORS**: Cross-origin resource sharing

### Mobile App (Frontend)
- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and tools
- **React Navigation**: Navigation library
- **Expo SQLite**: Local database for offline functionality

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Expo CLI** (for mobile development)
- **Android Studio** (for Android development) or **Xcode** (for iOS development)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd bulletproof-journal
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your configuration
# No authentication setup needed

# Initialize the database
npm run init-db

# Start the development server
npm run dev
```

The backend server will start on `http://localhost:3000`

### 3. Mobile App Setup

```bash
# Navigate to mobile app directory
cd mobile-app

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```

### 4. Running the App

- **For Android**: Press `a` in the Expo CLI or scan the QR code with Expo Go app
- **For iOS**: Press `i` in the Expo CLI or scan the QR code with Expo Go app
- **For Web**: Press `w` in the Expo CLI

## 📚 API Documentation

### Journal Endpoints

- `GET /api/journal` - Get all journal entries (with pagination)
- `POST /api/journal` - Create a new journal entry
- `GET /api/journal/:id` - Get a specific journal entry
- `PUT /api/journal/:id` - Update a journal entry
- `DELETE /api/journal/:id` - Delete a journal entry

### Health Check

- `GET /api/health` - API health status

## 🔒 Security Features

- CORS protection
- Helmet security middleware
- Input validation and sanitization
- SQL injection prevention

## 📱 Mobile App Features

- Responsive design for various screen sizes
- Pull-to-refresh functionality
- Loading states and error handling
- Simple, intuitive interface

## 🗄️ Database Schema

### Journal Entries Table
- `id` (Primary Key)
- `title`
- `content`
- `mood_rating` (1-10)
- `tags` (JSON array)
- `is_private` (Boolean)
- `created_at`
- `updated_at`

### Goals Table
- `id` (Primary Key)
- `title`
- `description`
- `target_date`
- `is_completed` (Boolean)
- `priority` (1-5)
- `created_at`
- `updated_at`
- `completed_at`

### Habits & Habit Logs Tables
- Similar structure for habit tracking functionality

## 🔧 Development

### Backend Development

```bash
# Start development server with auto-reload
npm run dev

# Initialize/reset database
npm run init-db

# Run in production mode
npm start
```

### Mobile App Development

```bash
# Start Expo development server
npx expo start

# Clear cache and restart
npx expo start --clear

# Build for production
npx expo build:android
npx expo build:ios
```

## 📝 Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:19006
LOG_LEVEL=info
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

1. **Backend not starting**: Check if the port 3000 is available
2. **Database errors**: Run `npm run init-db` to initialize the database
3. **Mobile app not connecting**: Ensure backend is running and CORS is configured
4. **Expo issues**: Try clearing cache with `npx expo start --clear`

### Getting Help

- Check the [Issues](link-to-issues) page for known problems
- Create a new issue if you encounter a bug
- Join our [Discord](link-to-discord) for community support

## 🏗️ Future Enhancements

- [ ] Photo attachments for journal entries
- [ ] Data export functionality
- [ ] Dark mode support
- [ ] Push notifications for reminders
- [ ] Social sharing features
- [ ] Advanced analytics and insights
- [ ] Cloud synchronization
- [ ] Voice-to-text functionality