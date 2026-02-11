// Alternative HomeScreen without LinearGradient - fallback option
// Replace the import and styles if LinearGradient doesn't work

// Remove this import:
// import { LinearGradient } from 'expo-linear-gradient';

// Replace LinearGradient components with View and these fallback styles:

const fallbackStyles = {
  // Replace LinearGradient headers with solid color
  header: {
    backgroundColor: '#667eea', // Single color instead of gradient
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  
  // Replace gradient loading with solid color
  loadingContainer: {
    flex: 1,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Replace gradient stat cards with solid colors
  statCardGradient: {
    backgroundColor: '#667eea', // Use single color
    padding: 20,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  
  // Replace gradient action containers with solid colors
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: '#667eea', // Use single color
  },
  
  // Replace gradient quote card with solid color
  quoteGradient: {
    backgroundColor: '#667eea',
    padding: 24,
  },
  
  // Replace gradient create account button
  createAccountGradient: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
};

// Instructions:
// 1. Remove LinearGradient import
// 2. Replace all <LinearGradient> with <View>
// 3. Replace gradient style props with single backgroundColor
// 4. Remove 'colors' prop and use backgroundColor instead