# Stickman Character & Audio Context

This document serves as the **Single Source of Truth** for the visual and audio identity of "Si Penunjuk" (The Pointer), the AI mascot for TKA Math Mastery videos.

Any changes to the character's appearance or voice should be updated here first, then propagated to `src/video-automator.js`.

---

## 1. Master Visual Blueprint (Lockdown)

Use this exact text block in prompt engineering to ensure consistent character generation across scenes.

> **CHARACTER BLUEPRINT:**  
> A minimalist 2D black stickman 'Si Penunjuk' on a clean white background.  
> **HEAD:** Perfect large circle with a crisp thin black outline.  
> **HAIR:** Exactly 2 very thin curved strands growing from the top-center of the head, pointing upwards; hair must NOT obscure the face.  
> **EYES:** Two identical solid black vertical oval dots positioned in the upper-middle of the face.  
> **MOUTH:** A very wide, thin black crescent smile reaching near the edges of the face.  
> **BODY ANATOMY (STRICTLY CONNECTED):** The character's anatomy must be a single continuous skeleton with no floating parts.  
> - **TORSO:** A single, straight vertical black line (monoline).  
> - **ARMS:** Two single thin lines originating directly from the top of the torso line.  
> - **LEGS:** Two single thin lines originating directly from the bottom of the torso line.  
> - **LINE WEIGHT:** All body and limb lines must have uniform medium-thin thickness.  
> **HANDS/FEET:** Small solid black ovals attached to the ends of limbs.  
> **STYLE:** Ultra-clean 2D Vector Line Art, High Contrast, No shading, No gradients, Flat design.

---

## 2. Master Audio Blueprint (Lockdown)

Use this specification to prevent AI voice drift (e.g., accidental female voices).

> **VOICE PROFILE:**  
> **STRICTLY MALE.** A youthful, energetic masculine voice with a distinct male baritone resonance.  
> **Texture:** Crisp, clear, and distinctly deep-toned.  
> **Constraint:** NO FEMALE INFLECTIONS.  
> **Pitch:** Medium-low to ensure masculine depth.  
> **Tone:** Strategic motivator, high-energy coach.  
> **Language:** Casual Indonesian slang with a cool, brotherly vibe.

---

## 3. Implementation Notes

- **File Location:** `src/video-automator.js`
- **Variable:** `const systemInstruction`
- **Usage Strategy:**
    1. The visual blueprint must be injected into **every single scene prompt** (do not use "Same as before").
    2. The audio tag `(Voice Profile: STRICTLY MALE)` must be appended to the VOICEOVER label for every scene to reinforce the gender constraint.