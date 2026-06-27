import { presentationStrategist } from "../agents/presentationStrategist";
import { layoutSelectorAgent } from "../agents/layoutSelectorAgent";
import { slideCreationAgent } from "../agents/slideCreationAgent";
import { validateAndFixSlide, enforceLayoutVariety } from "../services/deckQA";
import { generatePDF } from "../renderers/pdf.renderer";
import { resolveDeckType } from "../config/deckTypes";
import { resolveAccentOverride } from "../config/accentColors";

const prompt = `## Metropolis WhatsApp & SMS Customer Engagement Platform ### Proposal by Marichi Solutions --- # SLIDE 1 ## Transform Customer Engagement with WhatsApp & SMS ### Proposal for Metropolis ### The Challenge Modern customers expect instant, personalized, and convenient communication. Traditional communication channels often result in low engagement, delayed responses, and missed opportunities. ### The Opportunity By leveraging WhatsApp Business and SMS, Metropolis can communicate with customers on channels they use every day, improving customer experience, increasing engagement, and streamlining operations. ### Why This Matters •⁠ ⁠Reach customers instantly •⁠ ⁠Improve appointment adherence •⁠ ⁠Deliver timely service notifications •⁠ ⁠Increase campaign effectiveness •⁠ ⁠Enhance customer satisfaction •⁠ ⁠Build stronger customer relationships ### Presented By *Marichi Solutions* Digital Transformation | Customer Engagement | Business Automation --- # SLIDE 2 ## Why WhatsApp & SMS for Metropolis? ### Meet Customers Where They Already Are Customers today prefer messaging over emails and phone calls. | Channel  | Average Open Rate | | -------- | ----------------- | | Email    | ~20%              | | SMS      | ~90%+             | | WhatsApp | ~98%+             | ### WhatsApp Benefits ✅ Rich interactive conversations ✅ Images, Reports, PDFs & Documents ✅ Quick Reply Buttons ✅ Real-Time Customer Support ✅ Personalized Marketing Campaigns ✅ Higher Customer Engagement ### SMS Benefits ✅ Universal Reach ✅ Works Without Internet ✅ Instant Delivery ✅ Ideal for OTPs & Critical Alerts ✅ Reliable Backup Communication Channel ### Key Use Cases for Metropolis •⁠ ⁠Appointment Reminders •⁠ ⁠Diagnostic Report Notifications •⁠ ⁠Customer Support •⁠ ⁠Promotional Campaigns •⁠ ⁠Health Package Promotions •⁠ ⁠Customer Feedback Collection •⁠ ⁠Service Updates & Alerts ### Business Impact •⁠ ⁠Increased customer engagement •⁠ ⁠Reduced missed appointments •⁠ ⁠Better campaign performance •⁠ ⁠Faster customer communication •⁠ ⁠Improved customer satisfaction --- # SLIDE 3 ## Commercial Proposal ### One-Time Setup Fee | Service                                          | Cost      | | ------------------------------------------------ | --------- | | WhatsApp Business Platform Setup & Configuration | USD 1,000 | ### Includes •⁠ ⁠WhatsApp Business API Setup •⁠ ⁠Business Verification Assistance •⁠ ⁠Template Creation & Approval Support •⁠ ⁠Initial Platform Configuration •⁠ ⁠User Training •⁠ ⁠Go-Live Support --- ### Monthly Recurring Charges | Service                         | Cost            | | -------------------------------- | --------------- | | Platform Subscription & Support | USD 200 / Month | ### Includes •⁠ ⁠Platform Access •⁠ ⁠Hosting & Infrastructure •⁠ ⁠Monitoring & Maintenance •⁠ ⁠Technical Support •⁠ ⁠Security Updates •⁠ ⁠Product Enhancements ### Why Marichi Solutions? •⁠ ⁠Enterprise-grade platform •⁠ ⁠Proven customer engagement expertise •⁠ ⁠End-to-end implementation support •⁠ ⁠Scalable communication infrastructure •⁠ ⁠Dedicated post-launch support --- # SLIDE 4 ## Messaging Charges & Implementation Plan ### Usage-Based Pricing | Channel  | Message Type            | Cost     | | -------- | ------------------------ | -------- | | WhatsApp | Utility Conversations   | ZMW 0.20 | | WhatsApp | Marketing Conversations | ZMW 0.67 | | SMS      | Outbound SMS            | ZMW 0.12 | ### Implementation Timeline *Week 1* Commercial Approval & Project Kickoff *Week 2* Business Verification & Account Setup *Week 3* Platform Configuration, SMS Setup & Testing *Week 4* Training, UAT & Go-Live --- ## Investment Summary ### One-Time Setup *USD 1,000* ### Monthly Subscription *USD 200* ### Closing Statement *Partnering with Metropolis to create a modern, scalable, and highly engaging customer communication ecosystem powered by WhatsApp and SMS.* ### Marichi Solutions Driving Digital Customer Engagement`;

async function main() {
  const deckType = resolveDeckType("proposal");
  const accentOverride = resolveAccentOverride("blue");
  const noOfSlides = 21;

  const { analysis, deck } = await presentationStrategist({ prompt }, noOfSlides, deckType);
  console.log("deckTitle:", deck.deckTitle);

  deck.slides = await layoutSelectorAgent(deck.slides, deck.deckTitle, deck.storyTheme, deckType);
  deck.slides = enforceLayoutVariety(deck.slides, deckType);
  console.log("layouts:", deck.slides.map((s: any) => s.recommendedLayout).join(", "));

  const enrichedAnalysis = { ...analysis, _userPrompt: prompt };
  const mergedSlides = (await Promise.all(
    deck.slides.map((slide: any) => slideCreationAgent(enrichedAnalysis, deck.storyTheme, slide))
  )).map((slide: any, index: number) => ({
    ...slide,
    slideNumber: deck.slides[index].slideNumber,
    slideType: slide.slideType || deck.slides[index].slideType,
    recommendedLayout: slide.recommendedLayout || deck.slides[index].recommendedLayout,
  }));

  const finalSlides = await Promise.all(
    mergedSlides.map((slide: any) => validateAndFixSlide(slide, enrichedAnalysis, deck.storyTheme))
  );

  for (const s of finalSlides) {
    if (["split_insight", "minimal", "text_chart", "metrics"].includes(s.recommendedLayout)) {
      console.log(`\n--- slide ${s.slideNumber} [${s.recommendedLayout}] "${s.title}" ---`);
      console.log("bulletPoints:", JSON.stringify(s.bulletPoints));
      console.log("metrics:", JSON.stringify(s.metrics));
      console.log("chartBars:", JSON.stringify(s.chartBars));
    }
  }

  const pdfPath = await generatePDF(deck.deckTitle, finalSlides, deck.storyTheme, "corporate", "widescreen_16_9", accentOverride);
  console.log("\nPDF →", pdfPath);
}

main().catch(e => { console.error(e); process.exit(1); });
