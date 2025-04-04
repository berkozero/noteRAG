/**
 * Debug script for note creation
 */
const nodeFetch = require('node-fetch');

async function testCreateNote() {
  try {
    console.log("Testing note creation...");
    
    // The simplest possible note object - server will generate the ID
    const note = {
      text: "Test note content",
      title: "Test Note",
      timestamp: Date.now()
    };
    
    console.log("Sending note:", JSON.stringify(note, null, 2));
    
    const response = await nodeFetch('http://localhost:3000/api/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(note)
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log("Success! Created note:", result);
    } else {
      const errorText = await response.text();
      console.error("Error response:", errorText);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testCreateNote(); 