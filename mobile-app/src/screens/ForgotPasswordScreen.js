import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const ForgotPasswordScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const { resetPassword } = useAuth();

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        setLoading(true);
        const { error } = await resetPassword(email);
        setLoading(false);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert(
                'Check Your Email',
                'A password reset link has been sent to your email address. Please check your inbox.',
                [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
            );
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
                Enter the email address associated with your account and we'll send you a link to reset your password.
            </Text>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={loading}>
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkButton}>
                <Text style={styles.linkText}>Back to Login</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        backgroundColor: '#F5F7FA',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        padding: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
        color: '#333',
    },
    subtitle: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    inputContainer: {
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#E1E1E1',
        color: '#333',
    },
    button: {
        backgroundColor: '#4A90E2',
        padding: 18,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    linkButton: {
        alignItems: 'center',
    },
    linkText: {
        color: '#4A90E2',
        fontSize: 16,
    },
});

export default ForgotPasswordScreen;
