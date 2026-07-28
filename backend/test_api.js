const axios = require('axios');
async function testAPI() {
  try {
    const res = await axios.get('http://localhost:5000/api/service-requests');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("ERROR:", err.response ? err.response.data : err.message);
  }
}
testAPI();
