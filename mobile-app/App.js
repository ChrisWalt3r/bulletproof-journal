import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

// Import context and API initialization
import { AccountProvider } from './src/context/AccountContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { initializeApi } from './src/services/api';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import JournalListScreen from './src/screens/JournalListScreen';
import CreateEntryScreen from './src/screens/CreateEntryScreen';
import EditEntryScreen from './src/screens/EditEntryScreen';
import EntryDetailScreen from './src/screens/EntryDetailScreen';
import CriteriaScreen from './src/screens/CriteriaScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AccountJournalScreen from './src/screens/AccountJournalScreen';
import AccountGrowthScreen from './src/screens/AccountGrowthScreen';
import LoadingScreen from './src/screens/LoadingScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const AuthStack = createStackNavigator();

// Journal Stack Navigator
function JournalStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JournalList" component={JournalListScreen} />
      <Stack.Screen name="CreateEntry" component={CreateEntryScreen} />
      <Stack.Screen name="EditEntry" component={EditEntryScreen} />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
    </Stack.Navigator>
  );
}

// Settings Stack Navigator
function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="AccountJournal" component={AccountJournalScreen} />
      <Stack.Screen name="AccountGrowth" component={AccountGrowthScreen} />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
      <Stack.Screen name="CreateEntry" component={CreateEntryScreen} />
      <Stack.Screen name="EditEntry" component={EditEntryScreen} />
    </Stack.Navigator>
  );
}

// Auth Navigator
function AuthenticationNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

// Main App Navigation Wrapper
const AppNavigation = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {user ? (
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Journal') {
                iconName = focused ? 'book' : 'book-outline';
              } else if (route.name === 'Criteria') {
                iconName = focused ? 'list' : 'list-outline';
              } else if (route.name === 'Settings') {
                iconName = focused ? 'settings' : 'settings-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#4A90E2',
            tabBarInactiveTintColor: 'gray',
            headerShown: false,
            tabBarStyle: {
              paddingBottom: 5,
              paddingTop: 5,
              height: 60,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
            },
          })}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarLabel: 'Home',
            }}
          />
          <Tab.Screen
            name="Criteria"
            component={CriteriaScreen}
            options={{
              tabBarLabel: 'Criteria',
            }}
          />
          <Tab.Screen
            name="Journal"
            component={JournalStack}
            options={{
              tabBarLabel: 'Journal',
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsStack}
            options={{
              tabBarLabel: 'Settings',
            }}
          />
        </Tab.Navigator>
      ) : (
        <AuthenticationNavigator />
      )}
    </NavigationContainer>
  );
};

export default function App() {
  const [isApiReady, setIsApiReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('App.js: Initializing app...');
        await initializeApi();
        setIsApiReady(true);
      } catch (error) {
        console.error('App.js: Initialization error:', error);
        setIsApiReady(true);
      }
    };

    initializeApp();
  }, []);

  if (!isApiReady) {
    return <LoadingScreen message="Initializing app..." />;
  }

  return (
    <AuthProvider>
      <AccountProvider>
        <AppNavigation />
      </AccountProvider>
    </AuthProvider>
  );
}
