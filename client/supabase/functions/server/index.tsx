import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";

const app = new Hono();

// Create Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Log server configuration on startup
console.log('=== Server Configuration ===');
console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key exists:', !!supabaseServiceRoleKey);
console.log('Service Role Key length:', supabaseServiceRoleKey?.length);
console.log('Anon Key exists:', !!supabaseAnonKey);
console.log('Anon Key length:', supabaseAnonKey?.length);
console.log('===========================');

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-32246f9a/health", (c) => {
  return c.json({ status: "ok" });
});

// Debug endpoint to check configuration
app.get("/make-server-32246f9a/debug/config", (c) => {
  return c.json({
    supabaseUrl: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceRoleKey: !!supabaseServiceRoleKey,
    anonKeyPrefix: supabaseAnonKey?.substring(0, 20),
    serviceRoleKeyPrefix: supabaseServiceRoleKey?.substring(0, 20),
  });
});

// Test endpoint to check JWT without validation
app.post("/make-server-32246f9a/auth/test-token", async (c) => {
  try {
    const { token } = await c.req.json();
    
    console.log('=== Testing JWT Token ===');
    console.log('Token received:', !!token);
    console.log('Token length:', token?.length);
    console.log('Token (first 100 chars):', token?.substring(0, 100));
    
    // Try to decode the JWT (just the payload, no verification)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        console.log('JWT Payload:', payload);
        console.log('Issued at:', new Date(payload.iat * 1000).toISOString());
        console.log('Expires at:', new Date(payload.exp * 1000).toISOString());
        console.log('Is expired:', Date.now() / 1000 > payload.exp);
      }
    } catch (e) {
      console.log('Could not decode JWT:', e);
    }
    
    // Now try to validate with Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data, error } = await supabase.auth.getUser(token);
    
    console.log('Validation result:', {
      hasUser: !!data?.user,
      userId: data?.user?.id,
      error: error?.message
    });
    console.log('========================');
    
    return c.json({ 
      decoded: true,
      valid: !!data?.user,
      error: error?.message 
    });
  } catch (error) {
    console.error('Test token error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==================== AUTH ROUTES ====================

// Sign up endpoint
app.post("/make-server-32246f9a/auth/signup", async (c) => {
  try {
    const { email, password, fullName, churchName, churchRole, services } = await c.req.json();
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email since email server isn't configured
      user_metadata: {
        full_name: fullName,
        church_name: churchName,
        church_role: churchRole || '',
        services: Array.isArray(services) ? services : (services ? [services] : []),
      }
    });

    if (authError) {
      console.error(`Error creating user during signup: ${authError.message}`, authError);
      return c.json({ error: authError.message }, 400);
    }

    // Store user profile in KV store
    await kv.set(`profile:${authData.user.id}`, {
      id: authData.user.id,
      email: authData.user.email,
      full_name: fullName,
      church_name: churchName,
      church_role: churchRole || '',
      services: Array.isArray(services) ? services : (services ? [services] : []),
      avatar_url: null,
      created_at: new Date().toISOString(),
    });

    console.log(`Successfully created user account: ${email}`);

    return c.json({ 
      success: true,
      user: authData.user 
    });
  } catch (error) {
    console.error(`Unexpected error during signup:`, error);
    return c.json({ error: "Failed to create account" }, 500);
  }
});

// Get user profile
app.get("/make-server-32246f9a/auth/profile", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    console.log('=== Profile Request ===');
    console.log('Auth header received:', authHeader ? 'Yes' : 'No');
    
    const accessToken = authHeader?.split(' ')[1];
    console.log('Token extracted:', accessToken ? 'Yes' : 'No');
    console.log('Token length:', accessToken?.length);
    console.log('Token (first 50 chars):', accessToken?.substring(0, 50));
    
    if (!accessToken) {
      return c.json({ error: "No authorization token provided" }, 401);
    }

    // Validate the token by calling Supabase REST API directly
    console.log('Validating JWT with Supabase REST API...');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Using anon key for apikey header');
    
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabaseAnonKey
      }
    });

    console.log('Supabase user endpoint status:', userResponse.status);
    console.log('Supabase user endpoint status text:', userResponse.statusText);
    
    const responseText = await userResponse.text();
    console.log('Supabase raw response:', responseText);
    
    let errorData;
    try {
      errorData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', responseText);
      return c.json({ 
        error: "Invalid response from auth server",
        code: 500,
        message: "Failed to parse auth response"
      }, 500);
    }
    
    if (!userResponse.ok) {
      console.error('JWT validation failed with status:', userResponse.status);
      console.error('Error data:', errorData);
      return c.json({ 
        error: "Unauthorized", 
        code: 401, 
        message: errorData.msg || errorData.message || "Invalid JWT",
        details: errorData 
      }, 401);
    }

    const userData = errorData;
    console.log('User validated successfully:', userData.id);
    console.log('User email:', userData.email);

    // Get profile from KV store
    const profile = await kv.get(`profile:${userData.id}`);

    if (!profile) {
      console.error(`Profile not found for user: ${userData.id}`);
      return c.json({ error: "Profile not found" }, 404);
    }

    console.log('Profile found and returned');
    console.log('======================');
    return c.json({ profile });
  } catch (error) {
    console.error(`Unexpected error in profile endpoint:`, error);
    return c.json({ error: "Failed to get profile", details: String(error) }, 500);
  }
});

// Update user profile
app.put("/make-server-32246f9a/auth/profile", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: "No authorization token provided" }, 401);
    }

    // Create a client with the user's access token to verify it
    const userSupabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );
    
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      console.error(`Error authorizing user during profile update: ${authError?.message}`);
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { fullName, churchName, churchRole, avatarUrl, services } = await c.req.json();

    // Get existing profile
    const existingProfile = await kv.get(`profile:${user.id}`);

    if (!existingProfile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    // Update profile
    const updatedProfile = {
      ...existingProfile,
      full_name: fullName ?? existingProfile.full_name,
      church_name: churchName ?? existingProfile.church_name,
      church_role: churchRole ?? existingProfile.church_role,
      services: Array.isArray(services) ? services : (services ? [services] : []),
      avatar_url: avatarUrl ?? existingProfile.avatar_url,
    };

    await kv.set(`profile:${user.id}`, updatedProfile);

    return c.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error(`Unexpected error updating profile:`, error);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

// ==================== FAVORITES ROUTES ====================

// Get user's favorites
app.get("/make-server-32246f9a/favorites/:type", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const type = c.req.param('type'); // 'hymns', 'images', or 'sayings'
    
    if (!accessToken) {
      return c.json({ error: "No authorization token provided" }, 401);
    }

    const userSupabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );
    
    const { data: { user }, error } = await userSupabase.auth.getUser();

    if (error || !user) {
      console.error(`Error getting user favorites: ${error?.message}`);
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get favorites from KV store
    const favorites = await kv.get(`favorites:${type}:${user.id}`) || [];

    return c.json({ favorites });
  } catch (error) {
    console.error(`Unexpected error getting favorites:`, error);
    return c.json({ error: "Failed to get favorites" }, 500);
  }
});

// Add to favorites
app.post("/make-server-32246f9a/favorites/:type", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const type = c.req.param('type');
    
    if (!accessToken) {
      return c.json({ error: "No authorization token provided" }, 401);
    }

    const userSupabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );
    
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      console.error(`Error authorizing user when adding favorite: ${authError?.message}`);
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { itemId } = await c.req.json();

    // Get existing favorites
    const favorites = await kv.get(`favorites:${type}:${user.id}`) || [];

    // Check if already favorited
    if (favorites.includes(itemId)) {
      return c.json({ success: true, message: "Already favorited" });
    }

    // Add to favorites
    favorites.push(itemId);
    await kv.set(`favorites:${type}:${user.id}`, favorites);

    return c.json({ success: true, favorites });
  } catch (error) {
    console.error(`Unexpected error adding favorite:`, error);
    return c.json({ error: "Failed to add favorite" }, 500);
  }
});

// Remove from favorites
app.delete("/make-server-32246f9a/favorites/:type/:itemId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const type = c.req.param('type');
    const itemId = parseInt(c.req.param('itemId'));
    
    if (!accessToken) {
      return c.json({ error: "No authorization token provided" }, 401);
    }

    const userSupabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );
    
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      console.error(`Error authorizing user when removing favorite: ${authError?.message}`);
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get existing favorites
    const favorites = await kv.get(`favorites:${type}:${user.id}`) || [];

    // Remove from favorites
    const updatedFavorites = favorites.filter((id: number) => id !== itemId);
    await kv.set(`favorites:${type}:${user.id}`, updatedFavorites);

    return c.json({ success: true, favorites: updatedFavorites });
  } catch (error) {
    console.error(`Unexpected error removing favorite:`, error);
    return c.json({ error: "Failed to remove favorite" }, 500);
  }
});

// Add multiple items to favorites (batch operation)
app.post("/make-server-32246f9a/favorites/:type/batch", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const type = c.req.param('type');
    
    if (!accessToken) {
      return c.json({ error: "No authorization token provided" }, 401);
    }

    const userSupabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );
    
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      console.error(`Error authorizing user when batch adding favorites: ${authError?.message}`);
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { itemIds } = await c.req.json();

    // Get existing favorites
    const favorites = await kv.get(`favorites:${type}:${user.id}`) || [];

    // Add new favorites (avoiding duplicates)
    const newFavorites = [...new Set([...favorites, ...itemIds])];
    await kv.set(`favorites:${type}:${user.id}`, newFavorites);

    return c.json({ success: true, favorites: newFavorites });
  } catch (error) {
    console.error(`Unexpected error batch adding favorites:`, error);
    return c.json({ error: "Failed to add favorites" }, 500);
  }
});

Deno.serve(app.fetch);