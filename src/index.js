/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npx wrangler dev src/index.js` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npx wrangler publish src/index.js --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Headers": "Content-Type"
};
const dhlGetCityNameUrl = 'https://weixin.5idhl.com/api/wiplus/base/city/cityZipCodeOrZipCodeCity';
const dhlCheckRemoteUrl = 'https://weixin.5idhl.com/api/wiplus/base/mailing/remoteAreaQuery';
const jsonHeaders = {
  'Content-Type': 'application/json'
};
async function getCity(zipcode) {
  const dhlZipcodeObj = {
    countryCode: 'US',
    zipCode: zipcode,
  };
  const response = await fetch(dhlGetCityNameUrl, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(dhlZipcodeObj)
  });
  const result = await response.json();
  return result.data.list;
}

async function getRemote(cityName, zipcode) {
  const dhlRemoteObj = {
    toCountryName: 'United States Of America(美国)',
    toCountryCode: 'US',
    toCity: cityName,
    toZipCode: zipcode,
    expressType: 'WPX'
  };
  const response = await fetch(dhlCheckRemoteUrl, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(dhlRemoteObj)
  });
  const result = await response.json();
  return result.data.result;
}

async function readRequestBody(request) {
  const contentType = request.headers.get("content-type");
  if (contentType.includes("application/json")) {
    return await request.json();
  } else if (contentType.includes("application/text")) {
    return request.text();
  } else if (contentType.includes("text/html")) {
    return request.text();
  } else if (contentType.includes("form")) {
    const formData = await request.formData();
    const body = {};
    for (const entry of formData.entries()) {
      body[entry[0]] = entry[1];
    }
    return JSON.stringify(body);
  } else {
    return "a file";
  }
}

async function handleOptions(request) {
  if (
    request.headers.get("Origin") !== null &&
    request.headers.get("Access-Control-Request-Method") !== null &&
    request.headers.get("Access-Control-Request-Headers") !== null
  ) {
    // Handle CORS preflight requests.
    return new Response(null, {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Headers": request.headers.get(
          "Access-Control-Request-Headers"
        ),
      },
    });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS",
      },
    });
  }
}
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    if (request.method !== "POST") {
      return new Response(`Method ${request.method} not allowed.`, {
        status: 405,
        headers: {
          Allow: "POST"
        }
      });
    }
    const reqBody = await readRequestBody(request);
    const { zipcode } = reqBody;
    const list = await getCity(zipcode);
    if (list.length === 0) {
      const response = new Response(`Invalide zipcode: ${zipcode}`, { status: 200 })
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      return response;
    }
    const requests = list.map(addr => getRemote(addr.name, addr.code));
    const data = await Promise.all(requests);
    const result = list.map((item, index) => `${item.name}: ${data[index]}`).join('\n');
    const response = new Response(result, { status: 200 });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    return response;
  },
};
