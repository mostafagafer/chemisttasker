import React from 'react';
import { Tabs } from 'expo-router';
import { IconButton } from 'react-native-paper';

export default function OwnerLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="home" iconColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: 'Shifts',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="calendar" iconColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="post-shift"
        options={{
          title: 'Post',
          tabBarIcon: ({ color }) => (
            <IconButton
              icon="plus-circle"
              iconColor="#FFFFFF"
              size={32}
              style={{
                backgroundColor: '#6366F1',
                borderRadius: 24,
                marginTop: -20,
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="message" iconColor={color} size={size} />
          ),
        }}
      />

      {/* Hidden tabs - accessed via navigation */}
      <Tabs.Screen
        name="pharmacies"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
