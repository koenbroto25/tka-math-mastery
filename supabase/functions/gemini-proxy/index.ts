import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("1. Request received");

    // 1. Create Supabase Client with Auth Context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        console.error("Error: No Authorization header");
        throw new Error("Missing Authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 2. Get User from Token
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
        console.error("Error: User not found", userError);
        throw new Error("Unauthorized: No valid user found.");
    }
    console.log("2. User authenticated:", user.id);

    // 3. STRICT: Verify 'admin' role from 'profiles' table
    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profileError) {
        console.error("Error fetching profile:", profileError);
        throw new Error("Database Error: Could not fetch user profile.");
    }

    if (!profile || profile.role !== 'admin') {
        console.error("Error: Forbidden role:", profile?.role);
        return new Response(
            JSON.stringify({ error: `FORBIDDEN: User role is '${profile?.role}', required 'admin'.` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
    console.log("3. Admin role verified");

    // 4. Parse Request Body
    const { prompt, systemInstruction, model = 'gemini-1.5-pro' } = await req.json()

    if (!prompt) {
        throw new Error("Missing prompt in request body.")
    }
    console.log("4. Request body parsed. Model:", model);

    // 5. Call Google Gemini API
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY secret is missing");
        throw new Error("Server Configuration Error: GEMINI_API_KEY is missing in Supabase Secrets.")
    }
    console.log("5. API Key found");

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        // Add system instruction if provided
        ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } })
    }

    console.log("6. Calling Gemini API...");
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
        console.error("Gemini API Error Response:", data);
        throw new Error(data.error?.message || `Gemini API Error: ${response.status}`)
    }
    console.log("7. Gemini API Success");

    // 6. Return Result
    return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Global Catch Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})