import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("1. Video Automator Request received");

    // 2. Create Supabase Client with Auth Context
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

    // 3. Get User from Token
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
        console.error("Error: User not found", userError);
        throw new Error("Unauthorized: No valid user found.");
    }
    console.log("2. User authenticated:", user.id);

    // 4. STRICT: Verify 'admin' role from 'profiles' table
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

    // 5. Parse Request Body
    const { prompt, systemInstruction, model = 'gemini-3-flash-preview' } = await req.json()

    if (!prompt) {
        throw new Error("Missing prompt in request body.")
    }
    console.log("4. Request body parsed. Model:", model);

    // 6. Call Google Gemini API using the SECOND API KEY
    const apiKey = Deno.env.get('GEMINI_API_KEY2')
    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY2 secret is missing");
        throw new Error("Server Configuration Error: GEMINI_API_KEY2 is missing in Supabase Secrets.")
    }
    console.log("5. GEMINI_API_KEY2 found");

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } })
    }

    console.log("6. Calling Gemini API (Automator Mode)...");
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

    // 7. Return Result
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