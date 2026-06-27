import { generateIllustration } from "../services/illustration.service";

// Test: cover for a healthcare WhatsApp platform
const r1 = await generateIllustration("cover", "Metropolis WhatsApp & SMS Engagement Platform", "corporate", "hero", "widescreen_16_9", null);
console.log("healthcare cover:", r1?.fileName);

// Test: image_left with explicit search query
const r2 = await generateIllustration("use_cases", "Appointment Reminders for Patients", "corporate", "image_left", "widescreen_16_9", null, "doctor patient appointment hospital");
console.log("image_left with query:", r2?.fileName);
