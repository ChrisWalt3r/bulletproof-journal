# Bulletproof Journal Mobile App

A React Native mobile application for secure and intuitive journaling, built with Expo.

## 🚀 Features

- **Cross-Platform**: Runs on both iOS and Android
- **Secure Authentication**: Login and registration with secure token storage
- **Journal Management**: Create, read, update, and delete journal entries
- **Mood Tracking**: Rate your mood with each entry
- **Tag System**: Organize entries with custom tags
- **Search Functionality**: Find entries quickly
- **Offline Support**: Local SQLite database for offline functionality
- **Beautiful UI**: Clean, intuitive interface with smooth navigation

## 📋 Prerequisites

Before running the mobile app, ensure you have:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Expo CLI**: `npm install -g @expo/cli`
- **Mobile Device or Emulator**:
  - For iOS: Xcode simulator or physical iOS device with Expo Go app
  - For Android: Android Studio emulator or physical Android device with Expo Go app

## 🛠️ Installation

1. **Navigate to the mobile app directory**
   ```bash
   cd mobile-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the Expo development server**
   ```bash
   npx expo start
   ```

## 📱 Running the App

### Option 1: Mobile Device (Recommended)
1. Install **Expo Go** app from App Store (iOS) or Google Play Store (Android)
2. Run `npx expo start` in the project directory
3. Scan the QR code with your device camera (iOS) or Expo Go app (Android)

### Option 2: iOS Simulator
1. Install Xcode on macOS
2. Run `npx expo start`
3. Press `i` to open in iOS Simulator

### Option 3: Android Emulator
1. Install Android Studio and set up an Android Virtual Device (AVD)
2. Run `npx expo start`
3. Press `a` to open in Android Emulator

### Option 4: Web Browser
1. Run `npx expo start`
2. Press `w` to open in web browser

## 🏗️ Project Structure

```
mobile-app/
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # App screens
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── HomeScreen.js
│   │   ├── JournalListScreen.js
│   │   ├── CreateEntryScreen.js
│   │   └── LoadingScreen.js
│   ├── services/        # API and external services
│   │   └── api.js       # Backend API communication
│   ├── context/         # React Context providers
│   │   └── AuthContext.js # Authentication state management
│   └── utils/           # Utility functions
├── App.js               # Main app component with navigation
├── package.json         # Dependencies and scripts
└── app.json             # Expo configuration
```

## 🔧 Technology Stack

- **React Native**: Mobile app framework
- **Expo**: Development platform and tools
- **React Navigation**: Navigation library for stack and tab navigation
- **Expo SecureStore**: Secure storage for authentication tokens
- **Expo SQLite**: Local database for offline functionality
- **Axios**: HTTP client for API communication
- **React Context**: State management for authentication

## 🎨 Key Components

### Authentication Flow
- **LoginScreen**: User login with username/email and password
- **RegisterScreen**: New user registration
- **AuthContext**: Manages authentication state across the app

### Main Navigation
- **Bottom Tab Navigator**: 
  - Home: Dashboard with quick actions and stats
  - Journal: List of journal entries with search
  - Write: Create new journal entries
  - Profile: User profile and settings

### Core Features
- **Journal Entries**: Full CRUD operations with mood rating and tags
- **Search**: Real-time search through journal entries
- **Secure Storage**: Authentication tokens stored securely on device
- **Error Handling**: User-friendly error messages and loading states

## 📡 API Integration

The mobile app communicates with the backend API server:

- **Base URL**: `http://localhost:3000/api` (configurable in `src/services/api.js`)
- **Authentication**: JWT Bearer tokens
- **Endpoints**: Auth, Journal, and User management
- **Error Handling**: Automatic token refresh and error responses

### API Configuration

Update the API base URL in `src/services/api.js`:

```javascript
const API_BASE_URL = 'http://your-backend-url:3000/api';
```

## 🔒 Security Features

- **Secure Token Storage**: Uses Expo SecureStore for JWT tokens
- **Automatic Token Management**: Interceptors handle token inclusion and refresh
- **Input Validation**: Client-side validation for all forms
- **Secure Communication**: HTTPS recommended for production

## 📱 Screens Overview

### 🏠 Home Screen
- Welcome message with user's name
- Quick action buttons (Write, View Journal, Profile)
- Daily inspiration quote
- Basic statistics (entry count, weekly progress)

### 📝 Create Entry Screen
- Rich text input for journal content
- Title field
- Mood rating slider (1-10)
- Tag input system
- Privacy toggle (private/public)
- Save and cancel buttons

### 📚 Journal List Screen
- Paginated list of journal entries
- Search functionality
- Entry preview cards with title, date, and mood
- Pull-to-refresh
- Navigation to individual entries

### 👤 Profile Screen
- User information display
- Account settings
- Logout functionality
- App preferences

### 🔐 Authentication Screens
- Clean, user-friendly login and registration forms
- Input validation and error handling
- Navigation between login and registration

## 🎯 Development Scripts

```bash
# Start development server
npx expo start

# Start with cache clearing
npx expo start --clear

# Run on specific platform
npx expo start --ios
npx expo start --android
npx expo start --web

# Build for production
npx expo build:android
npx expo build:ios
```

## 🔧 Customization

### Styling
- Modify styles in individual screen files
- Global styles can be added to a shared styles file
- Color scheme can be updated throughout the app

### Features
- Add new screens by creating components in `src/screens/`
- Add new API endpoints in `src/services/api.js`
- Extend context providers in `src/context/`

## 🐛 Troubleshooting

### Common Issues

1. **Metro bundler issues**
   ```bash
   npx expo start --clear
   ```

2. **Dependencies not found**
   ```bash
   rm -rf node_modules
   npm install
   ```

3. **Network issues**
   - Ensure your device and computer are on the same network
   - Check firewall settings
   - Update Expo Go app

4. **Backend connection issues**
   - Verify backend server is running
   - Check API URL configuration
   - Ensure CORS is properly configured

### Platform-Specific Issues

**iOS:**
- Ensure Xcode is installed and updated
- Check iOS Simulator is running
- Verify iOS deployment target compatibility

**Android:**
- Ensure Android Studio is installed
- Check Android SDK and AVD setup
- Verify USB debugging is enabled (for physical devices)

## 📈 Performance Tips

1. **Optimize Images**: Use appropriate image formats and sizes
2. **Lazy Loading**: Implement lazy loading for large lists
3. **Memory Management**: Properly clean up listeners and subscriptions
4. **Bundle Size**: Use Expo optimization tools
5. **Network Requests**: Implement proper caching strategies

## 🚀 Deployment

### Expo Application Services (EAS)
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Configure EAS
eas build:configure

# Build for production
eas build --platform android
eas build --platform ios

# Submit to app stores
eas submit
```

### Standalone Apps
Follow Expo's documentation for creating standalone apps for iOS App Store and Google Play Store.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 📞 Support

- Create an issue for bug reports
- Join our community Discord for questions
- Check Expo documentation for platform-specific issues