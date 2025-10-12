/**
 * Test script for Sora API
 * Run with: node test-api.js
 */

import fs from 'fs';

const authToken = fs.readFileSync('./auth/sora2.auth', 'utf8').trim();
const userId = 'user-32fiaa4dthdesbfgwatwyjpr';
const baseUrl = 'https://sora.chatgpt.com/backend/nf';

console.log('🔧 Testing Sora API...\n');
console.log('Auth token loaded:', authToken.substring(0, 50) + '...\n');

// Test 1: GET /pending
async function testGetPending() {
  console.log('📋 Test 1: GET /pending');
  console.log('URL:', `${baseUrl}/pending`);

  try {
    const response = await fetch(`${baseUrl}/pending`, {
      method: 'GET',
      headers: {
        'Authorization': authToken,
        'openai-organization': userId
      }
    });

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('✅ GET /pending SUCCESS\n');
    return data;
  } catch (error) {
    console.error('❌ GET /pending FAILED:', error.message);
    console.error(error);
    return null;
  }
}

// Test 2: POST /create with JSON
async function testPostGenerate() {
  console.log('\n📤 Test 2: POST /create (with JSON)');
  console.log('URL:', `${baseUrl}/create`);

  const body = {
    kind: 'video',
    model: 'sora-2',
    prompt: 'Two tigers fighting',
    aspect_ratio: '16:9',
    duration: 3  // Try 5 seconds
  };

  console.log('Body:', JSON.stringify(body, null, 2));

  try {
    const response = await fetch(`${baseUrl}/create`, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'openai-organization': userId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    console.log('Status:', response.status);

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 200 || response.status === 201) {
      console.log('✅ POST /create SUCCESS\n');
      return data;
    } else {
      console.log('❌ POST /create FAILED\n');
      return null;
    }
  } catch (error) {
    console.error('❌ POST /create ERROR:', error.message, '\n');
    return null;
  }
}

// Run tests
(async () => {
  const pendingVideos = await testGetPending();

  // Uncomment to test POST (will create a video)
  await testPostGenerate();

  console.log('\n📊 Test Summary:');
  console.log('- GET /pending:', pendingVideos ? '✅ Working' : '❌ Failed');
})();
