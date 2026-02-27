import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { emailService } from './email.service';
import { discordService } from './discord.service';
import { onboardingService } from './onboarding.service';
import { PACKAGES } from '../types';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════
// ONBOARDING FLOW SERVICE
// Manages the complete post-trial-acceptance flow:
// 1. Welcome email + onboarding form link
// 2. Intelligent onboarding form by industry & package
// 3. Loom video personalization
// 4. Dashboard access + add-on upsells
// 5. Post-trial: invoice, contract, payment or deactivation
// ═══════════════════════════════════════════════════════════
export class OnboardingFlowService {

  // ═══════════════════════════════════════════════════════════
  // STEP 1: INITIATE ONBOARDING - Called when trial starts
  // Sends welcome email with form link + dashboard link
  // ═══════════════════════════════════════════════════════════
  async initiateOnboarding(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error(`Client not found: ${clientId}`);

    // Generate unique dashboard token for client portal access
    const dashboardToken = crypto.randomBytes(32).toString('hex');

    await prisma.client.update({
      where: { id: clientId },
      data: {
        dashboardToken,
        onboardingFormSentAt: new Date(),
      },
    });

    const formUrl = `${env.FRONTEND_URL}/onboarding/${clientId}?token=${dashboardToken}`;
    const dashboardUrl = `${env.FRONTEND_URL}/client-portal/${clientId}?token=${dashboardToken}`;

    // Send the comprehensive welcome + onboarding email
    await emailService.sendOnboardingEmail({
      to: client.contactEmail,
      contactName: client.contactName,
      businessName: client.businessName,
      businessType: client.businessType,
      planType: client.planType,
      isTrial: client.isTrial,
      trialEndDate: client.trialEndDate,
      formUrl,
      dashboardUrl,
      vapiPhoneNumber: client.vapiPhoneNumber || env.VAPI_PHONE_NUMBER,
    });

    logger.info(`Onboarding flow initiated for ${client.businessName} (form sent)`);
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: GET ONBOARDING FORM TEMPLATE
  // Returns industry-specific + package-specific form fields
  // ═══════════════════════════════════════════════════════════
  getOnboardingFormTemplate(businessType: string, planType: string): OnboardingFormTemplate {
    const baseFields: FormField[] = [
      { id: 'businessHours', label: 'Business Hours', type: 'textarea', required: true, placeholder: 'e.g. Mon-Fri 9am-6pm, Sat 10am-2pm, Sun Closed', section: 'basics' },
      { id: 'businessDescription', label: 'Short description of your business', type: 'textarea', required: true, placeholder: 'Describe what your business does in 2-3 sentences', section: 'basics' },
      { id: 'servicesOffered', label: 'Services you offer', type: 'textarea', required: true, placeholder: 'List your main services, one per line', section: 'basics' },
      { id: 'pricingInfo', label: 'Pricing information (optional)', type: 'textarea', required: false, placeholder: 'Any pricing you want the AI to know about', section: 'basics' },
      { id: 'address', label: 'Business Address', type: 'text', required: true, placeholder: '123 Main St, New York, NY 10001', section: 'basics' },
      { id: 'parkingInfo', label: 'Parking instructions', type: 'text', required: false, placeholder: 'e.g. Free parking in rear lot', section: 'basics' },
      { id: 'greetingStyle', label: 'How should we greet callers?', type: 'select', required: true, options: ['Professional & formal', 'Friendly & casual', 'Warm & welcoming', 'Energetic & upbeat'], section: 'personality' },
      { id: 'urgentProtocol', label: 'What counts as urgent? Who should we transfer to?', type: 'textarea', required: true, placeholder: 'e.g. Medical emergencies → call 911. Urgent customer complaints → transfer to manager at 555-1234', section: 'protocols' },
      { id: 'faq', label: 'Frequently asked questions & answers', type: 'textarea', required: true, placeholder: 'Q: Do you accept walk-ins?\nA: Yes, but appointments are recommended.\n\nQ: What payment methods do you accept?\nA: Cash, all major credit cards, and Apple Pay.', section: 'knowledge' },
    ];

    // Industry-specific fields
    const industryFields = this.getIndustryFormFields(businessType);

    // Package-specific fields
    const packageFields = this.getPackageFormFields(planType);

    const pkg = PACKAGES[planType] || PACKAGES.basic;

    return {
      businessType,
      planType,
      packageName: pkg.name,
      sections: [
        { id: 'basics', title: '📋 Business Basics', description: 'Tell us about your business so your AI receptionist knows the fundamentals.' },
        { id: 'personality', title: '🎭 Receptionist Personality', description: 'Customize how your AI receptionist sounds and behaves.' },
        { id: 'industry', title: '🏢 Industry-Specific Setup', description: 'Details specific to your type of business.' },
        { id: 'protocols', title: '⚡ Call Protocols', description: 'How should your AI handle different situations?' },
        { id: 'knowledge', title: '📚 Knowledge Base', description: 'Help your AI answer questions accurately.' },
        ...(packageFields.length > 0 ? [{ id: 'advanced', title: '🚀 Advanced Features', description: `Exclusive to your ${pkg.name} plan.` }] : []),
      ],
      fields: [...baseFields, ...industryFields, ...packageFields],
    };
  }

  // ═══════════════════════════════════════════════════════════
  // INDUSTRY-SPECIFIC FORM FIELDS
  // ═══════════════════════════════════════════════════════════
  private getIndustryFormFields(businessType: string): FormField[] {
    const type = businessType.toLowerCase();

    if (type.includes('restaurant') || type.includes('café') || type.includes('cafe') || type.includes('food') || type.includes('bar') || type.includes('bistro') || type.includes('pizzeria')) {
      return [
        { id: 'menuHighlights', label: 'Menu highlights & popular dishes', type: 'textarea', required: true, placeholder: 'List your most popular dishes, price ranges, and any signature items', section: 'industry' },
        { id: 'dietaryOptions', label: 'Dietary accommodations', type: 'multiselect', required: false, options: ['Vegetarian', 'Vegan', 'Gluten-free', 'Nut-free', 'Halal', 'Kosher', 'Dairy-free'], section: 'industry' },
        { id: 'reservationPolicy', label: 'Reservation policy', type: 'textarea', required: true, placeholder: 'e.g. Reservations recommended for parties of 4+, walk-ins welcome for smaller groups', section: 'industry' },
        { id: 'maxPartySize', label: 'Maximum party size', type: 'number', required: false, placeholder: 'e.g. 20', section: 'industry' },
        { id: 'privateEvents', label: 'Do you host private events?', type: 'select', required: false, options: ['Yes', 'No', 'Upon request'], section: 'industry' },
        { id: 'deliveryOptions', label: 'Delivery & takeout', type: 'multiselect', required: false, options: ['Dine-in', 'Takeout', 'Delivery', 'Catering', 'UberEats', 'DoorDash', 'Grubhub'], section: 'industry' },
      ];
    }

    if (type.includes('dental') || type.includes('dentist') || type.includes('orthodont')) {
      return [
        { id: 'servicesDetailed', label: 'Dental services offered', type: 'multiselect', required: true, options: ['Cleaning', 'Whitening', 'Fillings', 'Crowns', 'Root canals', 'Implants', 'Invisalign', 'Veneers', 'Extractions', 'Emergency care', 'Pediatric dentistry', 'Cosmetic dentistry'], section: 'industry' },
        { id: 'insuranceAccepted', label: 'Insurance providers accepted', type: 'textarea', required: true, placeholder: 'List insurance providers: Delta Dental, Cigna, Aetna, etc.', section: 'industry' },
        { id: 'newPatientProcess', label: 'New patient process', type: 'textarea', required: true, placeholder: 'e.g. Arrive 15min early, bring insurance card and ID, fill out forms online beforehand at...', section: 'industry' },
        { id: 'emergencyProtocol', label: 'Dental emergency protocol', type: 'textarea', required: true, placeholder: 'e.g. Same-day emergency appointments available. After hours → call Dr. Smith at 555-1234', section: 'industry' },
        { id: 'sedationOptions', label: 'Sedation options available', type: 'multiselect', required: false, options: ['Nitrous oxide (laughing gas)', 'Oral sedation', 'IV sedation', 'General anesthesia', 'None'], section: 'industry' },
      ];
    }

    if (type.includes('medical') || type.includes('doctor') || type.includes('clinic') || type.includes('physician') || type.includes('health')) {
      return [
        { id: 'specialties', label: 'Medical specialties', type: 'textarea', required: true, placeholder: 'e.g. Family medicine, Pediatrics, Internal medicine', section: 'industry' },
        { id: 'insuranceAccepted', label: 'Insurance accepted', type: 'textarea', required: true, placeholder: 'List insurance providers', section: 'industry' },
        { id: 'newPatientProcess', label: 'New patient process', type: 'textarea', required: true, placeholder: 'What should new patients bring? Any forms to fill?', section: 'industry' },
        { id: 'telehealth', label: 'Do you offer telehealth/video visits?', type: 'select', required: false, options: ['Yes', 'No', 'For some visits'], section: 'industry' },
        { id: 'labServices', label: 'On-site lab services?', type: 'select', required: false, options: ['Yes - full lab', 'Yes - basic bloodwork', 'No - we refer out'], section: 'industry' },
        { id: 'afterHoursProtocol', label: 'After-hours emergency protocol', type: 'textarea', required: true, placeholder: 'e.g. For emergencies call 911. For urgent after-hours, call answering service at...', section: 'industry' },
      ];
    }

    if (type.includes('salon') || type.includes('spa') || type.includes('beauty') || type.includes('hair') || type.includes('barber') || type.includes('nail')) {
      return [
        { id: 'servicesMenu', label: 'Full service menu with durations & prices', type: 'textarea', required: true, placeholder: 'Women\'s Haircut - 45min - $65\nMen\'s Cut - 30min - $35\nHighlights - 2hrs - $150+\n...', section: 'industry' },
        { id: 'stylists', label: 'Stylists/therapists (names & specialties)', type: 'textarea', required: false, placeholder: 'Sarah - Color specialist\nMike - Men\'s cuts & beard styling\nLisa - Massage therapist', section: 'industry' },
        { id: 'cancellationPolicy', label: 'Cancellation policy', type: 'textarea', required: true, placeholder: 'e.g. 24-hour notice required. Late cancellations charged 50% of service.', section: 'industry' },
        { id: 'walkInsAccepted', label: 'Walk-ins accepted?', type: 'select', required: true, options: ['Yes, always', 'Yes, when available', 'Appointments only'], section: 'industry' },
        { id: 'productsForSale', label: 'Products for sale', type: 'textarea', required: false, placeholder: 'Brands carried, popular products, gift cards', section: 'industry' },
      ];
    }

    if (type.includes('law') || type.includes('legal') || type.includes('attorney') || type.includes('lawyer')) {
      return [
        { id: 'practiceAreas', label: 'Practice areas', type: 'multiselect', required: true, options: ['Family Law', 'Personal Injury', 'Criminal Defense', 'Business/Corporate', 'Estate Planning', 'Immigration', 'Real Estate', 'Bankruptcy', 'Employment Law', 'Intellectual Property'], section: 'industry' },
        { id: 'consultationPolicy', label: 'Initial consultation policy', type: 'textarea', required: true, placeholder: 'e.g. Free 30-minute phone consultation. In-person consultations $150/hour.', section: 'industry' },
        { id: 'attorneys', label: 'Attorneys (names & specialties)', type: 'textarea', required: true, placeholder: 'John Smith - Family Law, 15 years experience\nJane Doe - Personal Injury', section: 'industry' },
        { id: 'urgentMatters', label: 'What qualifies as urgent?', type: 'textarea', required: true, placeholder: 'e.g. Arrests, restraining orders, court deadlines within 48hrs', section: 'industry' },
      ];
    }

    if (type.includes('real estate') || type.includes('realty') || type.includes('property') || type.includes('immobilier')) {
      return [
        { id: 'serviceAreas', label: 'Service areas / neighborhoods', type: 'textarea', required: true, placeholder: 'List areas/neighborhoods you serve', section: 'industry' },
        { id: 'agents', label: 'Agents (names & specialties)', type: 'textarea', required: true, placeholder: 'John - Luxury homes\nSarah - First-time buyers\nMike - Commercial', section: 'industry' },
        { id: 'propertyTypes', label: 'Property types handled', type: 'multiselect', required: true, options: ['Single-family homes', 'Condos', 'Townhouses', 'Multi-family', 'Commercial', 'Land', 'Luxury', 'Rentals'], section: 'industry' },
        { id: 'openHouseSchedule', label: 'Regular open house schedule', type: 'textarea', required: false, placeholder: 'e.g. Open houses every Saturday 1-4pm', section: 'industry' },
      ];
    }

    if (type.includes('auto') || type.includes('car') || type.includes('mechanic') || type.includes('garage') || type.includes('dealer')) {
      return [
        { id: 'servicesOfferedDetailed', label: 'Services offered (with estimated prices)', type: 'textarea', required: true, placeholder: 'Oil Change - $45-$75\nBrake Inspection - $50\nTire Rotation - $30\n...', section: 'industry' },
        { id: 'brandsServiced', label: 'Vehicle brands serviced', type: 'textarea', required: false, placeholder: 'All makes & models, or specific: Honda, Toyota, BMW...', section: 'industry' },
        { id: 'loanerVehicles', label: 'Loaner vehicles available?', type: 'select', required: false, options: ['Yes', 'No', 'Upon request / for major repairs'], section: 'industry' },
        { id: 'towingService', label: 'Towing service available?', type: 'select', required: false, options: ['Yes, free within 10 miles', 'Yes, for a fee', 'No, we recommend XYZ Towing'], section: 'industry' },
        { id: 'warrantyWork', label: 'Do you handle warranty work?', type: 'select', required: false, options: ['Yes - manufacturer warranty', 'Yes - extended warranty', 'No'], section: 'industry' },
      ];
    }

    if (type.includes('plumb') || type.includes('hvac') || type.includes('electric') || type.includes('contractor') || type.includes('handyman') || type.includes('cleaning')) {
      return [
        { id: 'serviceArea', label: 'Service area (cities/zip codes)', type: 'textarea', required: true, placeholder: 'List cities or zip codes you serve', section: 'industry' },
        { id: 'emergencyAvailability', label: 'Emergency/after-hours availability', type: 'select', required: true, options: ['24/7 emergency service', 'Emergency during business hours only', 'No emergency service'], section: 'industry' },
        { id: 'estimatePolicy', label: 'Estimate policy', type: 'textarea', required: true, placeholder: 'e.g. Free estimates for jobs over $500. $75 diagnostic fee for service calls.', section: 'industry' },
        { id: 'licensesInsurance', label: 'Licenses & insurance', type: 'textarea', required: false, placeholder: 'e.g. Licensed & insured. License #12345. $2M liability.', section: 'industry' },
      ];
    }

    if (type.includes('vet') || type.includes('animal') || type.includes('pet')) {
      return [
        { id: 'animalsServed', label: 'Animals served', type: 'multiselect', required: true, options: ['Dogs', 'Cats', 'Birds', 'Reptiles', 'Small mammals (hamsters, rabbits)', 'Horses', 'Exotic animals'], section: 'industry' },
        { id: 'servicesDetailed', label: 'Services offered', type: 'multiselect', required: true, options: ['Wellness exams', 'Vaccinations', 'Surgery', 'Dental care', 'X-ray/imaging', 'Emergency care', 'Boarding', 'Grooming', 'Microchipping', 'Nutrition counseling'], section: 'industry' },
        { id: 'emergencyProtocol', label: 'Emergency/after-hours protocol', type: 'textarea', required: true, placeholder: 'e.g. After-hours emergencies → Nearest 24hr vet at 555-1234', section: 'industry' },
        { id: 'newPetProcess', label: 'New patient process', type: 'textarea', required: true, placeholder: 'Bring vaccination records, any current medications, fill out form at...', section: 'industry' },
      ];
    }

    // Default
    return [
      { id: 'keyDifferentiators', label: 'What makes your business unique?', type: 'textarea', required: true, placeholder: 'What sets you apart from competitors?', section: 'industry' },
      { id: 'commonQuestions', label: 'Most common questions customers ask', type: 'textarea', required: true, placeholder: 'List the top 5 questions callers ask', section: 'industry' },
    ];
  }

  // ═══════════════════════════════════════════════════════════
  // PACKAGE-SPECIFIC FORM FIELDS (PRO & ENTERPRISE extras)
  // ═══════════════════════════════════════════════════════════
  private getPackageFormFields(planType: string): FormField[] {
    if (planType === 'basic') return [];

    const proFields: FormField[] = [
      { id: 'leadQualificationCriteria', label: 'How should we qualify leads?', type: 'textarea', required: false, placeholder: 'e.g. Ask about budget, timeline, and decision-making authority', section: 'advanced' },
      { id: 'bookingSystemUrl', label: 'Booking system URL (if any)', type: 'text', required: false, placeholder: 'e.g. https://calendly.com/yourbusiness', section: 'advanced' },
      { id: 'reminderPreferences', label: 'Customer reminder preferences', type: 'multiselect', required: false, options: ['Email 24h before', 'Email 1h before', 'No reminders'], section: 'advanced' },
    ];

    if (planType === 'pro') return proFields;

    // Enterprise gets everything + more
    return [
      ...proFields,
      { id: 'crmSystem', label: 'CRM system you use', type: 'select', required: false, options: ['Salesforce', 'HubSpot', 'Zoho', 'Freshsales', 'Pipedrive', 'None', 'Other'], section: 'advanced' },
      { id: 'googleCalendarEmail', label: 'Google Calendar email (for sync)', type: 'text', required: false, placeholder: 'yourbusiness@gmail.com', section: 'advanced' },
      { id: 'posSystem', label: 'POS system you use', type: 'select', required: false, options: ['Square', 'Clover', 'Toast', 'Shopify', 'Lightspeed', 'None', 'Other'], section: 'advanced' },
      { id: 'additionalLanguages', label: 'Languages your clients speak', type: 'multiselect', required: false, options: ['English', 'Spanish', 'French', 'Chinese (Mandarin)', 'Portuguese', 'Korean', 'Vietnamese', 'Arabic'], section: 'advanced' },
      { id: 'teamTrainingSchedule', label: 'Preferred time for team training', type: 'textarea', required: false, placeholder: 'e.g. Tuesday or Thursday morning, 10am-12pm EST', section: 'advanced' },
    ];
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: SUBMIT ONBOARDING FORM - Client fills in their data
  // Updates client + rebuilds VAPI assistant prompt
  // ═══════════════════════════════════════════════════════════
  async submitOnboardingForm(clientId: string, token: string, formData: Record<string, any>) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Client not found');
    if (client.dashboardToken !== token) throw new Error('Invalid token');

    // Save onboarding data
    await prisma.client.update({
      where: { id: clientId },
      data: {
        onboardingData: formData,
        onboardingFormDoneAt: new Date(),
        // Update address if provided
        ...(formData.address ? { address: formData.address } : {}),
      },
    });

    // Rebuild the VAPI assistant prompt with the new data
    if (client.vapiAssistantId) {
      try {
        const { vapiClient } = await import('../config/vapi');
        const enrichedPrompt = this.buildEnrichedPrompt(client, formData);
        await vapiClient.updateAssistant(client.vapiAssistantId, {
          model: {
            provider: 'openai',
            model: env.VAPI_MODEL,
            temperature: 0.7,
            messages: [{ role: 'system', content: enrichedPrompt }],
          },
        });
        logger.info(`VAPI assistant updated with onboarding data for ${client.businessName}`);
      } catch (err) {
        logger.error(`Failed to update VAPI assistant for ${client.businessName}:`, err);
      }
    }

    // Send Loom video placeholder email
    await emailService.sendLoomVideoEmail({
      to: client.contactEmail,
      contactName: client.contactName,
      businessName: client.businessName,
      dashboardUrl: `${env.FRONTEND_URL}/client-portal/${clientId}?token=${client.dashboardToken}`,
    });

    await discordService.notify(
      `📝 ONBOARDING FORM COMPLETED!\n\nClient: ${client.businessName}\nPlan: ${client.planType.toUpperCase()}\nIndustry: ${client.businessType}\n\n✅ VAPI assistant enriched with business data\n📹 Loom video email sent`
    );

    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════
  // BUILD ENRICHED PROMPT from onboarding form data
  // ═══════════════════════════════════════════════════════════
  private buildEnrichedPrompt(client: any, formData: Record<string, any>): string {
    const multiLangSupport = client.planType === 'enterprise'
      ? `\n- You speak ${(formData.additionalLanguages || ['English']).join(', ')}. Adapt your language to match the caller.`
      : '';

    const proFeatures = ['pro', 'enterprise'].includes(client.planType)
      ? '\n- Qualify leads by asking about their needs and budget\n- Collect email addresses for follow-up'
      : '';

    const greetingStyle = formData.greetingStyle || 'Warm & welcoming';

    return `You are the virtual receptionist for ${client.businessName}, a ${client.businessType} located at ${formData.address || client.address || 'the United States'}.

YOUR ROLE:
- Warmly greet all callers
- Answer frequently asked questions about the business
- Take bookings and appointments
- Log messages for the team
- Transfer urgent calls to the right person${proFeatures}${multiLangSupport}

BUSINESS INFORMATION:
- Name: ${client.businessName}
- Type: ${client.businessType}
- Phone: ${client.contactPhone || 'N/A'}
- Email: ${client.contactEmail}
- Hours: ${formData.businessHours || 'Ask the caller to call back during business hours'}
${formData.parkingInfo ? `- Parking: ${formData.parkingInfo}` : ''}

ABOUT THE BUSINESS:
${formData.businessDescription || ''}

SERVICES OFFERED:
${formData.servicesOffered || formData.servicesMenu || formData.servicesOfferedDetailed || ''}

${formData.pricingInfo ? `PRICING:\n${formData.pricingInfo}` : ''}

${formData.menuHighlights ? `MENU HIGHLIGHTS:\n${formData.menuHighlights}` : ''}
${formData.dietaryOptions?.length ? `DIETARY OPTIONS: ${formData.dietaryOptions.join(', ')}` : ''}
${formData.reservationPolicy ? `RESERVATION POLICY:\n${formData.reservationPolicy}` : ''}
${formData.insuranceAccepted ? `INSURANCE ACCEPTED:\n${formData.insuranceAccepted}` : ''}
${formData.newPatientProcess ? `NEW PATIENT PROCESS:\n${formData.newPatientProcess}` : ''}
${formData.practiceAreas?.length ? `PRACTICE AREAS: ${formData.practiceAreas.join(', ')}` : ''}
${formData.consultationPolicy ? `CONSULTATION POLICY:\n${formData.consultationPolicy}` : ''}
${formData.stylists ? `TEAM:\n${formData.stylists}` : ''}
${formData.agents ? `AGENTS:\n${formData.agents}` : ''}
${formData.attorneys ? `ATTORNEYS:\n${formData.attorneys}` : ''}

FREQUENTLY ASKED QUESTIONS:
${formData.faq || 'Answer to the best of your knowledge based on the information provided.'}

YOUR STYLE:
- ${greetingStyle}
- Positive and upbeat tone
- Short, clear sentences
- Polite and courteous at all times

URGENT CALL PROTOCOL:
${formData.urgentProtocol || 'For urgent matters, offer to transfer the call immediately.'}
${formData.emergencyProtocol || formData.afterHoursProtocol || ''}

${formData.cancellationPolicy ? `CANCELLATION POLICY:\n${formData.cancellationPolicy}` : ''}

${formData.leadQualificationCriteria ? `LEAD QUALIFICATION:\n${formData.leadQualificationCriteria}` : ''}

GENERAL INSTRUCTIONS:
1. For questions outside your knowledge: offer to take a message
2. For urgent matters: follow the urgent call protocol above
3. Always end with "Is there anything else I can help you with?"
4. If asked about pricing and you don't have specifics, say you'll have someone get back to them
5. Always collect caller's name and phone number

IMPORTANT: You represent ${client.businessName} - be impeccable!`;
  }

  // ═══════════════════════════════════════════════════════════
  // GET ADD-ON OPTIONS - Features client can activate for extra $
  // ═══════════════════════════════════════════════════════════
  getAvailableAddOns(planType: string): AddOn[] {
    const allAddOns: AddOn[] = [
      { id: 'appointment_booking', name: 'Smart Appointment Booking', description: 'AI books appointments directly into your calendar', price: 50, available: planType === 'basic' },
      { id: 'lead_qualification', name: 'Lead Qualification', description: 'AI qualifies leads and scores them automatically', price: 75, available: planType === 'basic' },
      { id: 'sms_reminders', name: 'SMS Appointment Reminders', description: 'Automated SMS reminders to customers before appointments', price: 30, available: ['basic', 'pro'].includes(planType) },
      { id: 'email_followup', name: 'Email Follow-up Sequences', description: 'Automated email follow-ups after calls', price: 40, available: ['basic', 'pro'].includes(planType) },
      { id: 'google_calendar', name: 'Google Calendar Integration', description: 'Sync all bookings to Google Calendar in real-time', price: 25, available: ['basic', 'pro'].includes(planType) },
      { id: 'multilingual', name: 'Multilingual Support', description: 'AI speaks English, Spanish, French, and Chinese', price: 100, available: ['basic', 'pro'].includes(planType) },
      { id: 'crm_integration', name: 'CRM Integration', description: 'Auto-sync leads and calls to your CRM (Salesforce, HubSpot, etc.)', price: 75, available: ['basic', 'pro'].includes(planType) },
      { id: 'extra_calls_100', name: '+100 Extra Calls/month', description: 'Additional 100 calls per month', price: 50, available: true },
      { id: 'extra_calls_500', name: '+500 Extra Calls/month', description: 'Additional 500 calls per month', price: 200, available: true },
      { id: 'priority_support', name: 'Priority Support', description: 'Phone + email priority support with 1-hour response time', price: 50, available: planType === 'basic' },
    ];

    return allAddOns.filter(a => a.available);
  }

  // ═══════════════════════════════════════════════════════════
  // ACTIVATE ADD-ON for a client
  // ═══════════════════════════════════════════════════════════
  async activateAddOn(clientId: string, addOnId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Client not found');

    const currentAddOns = (client.addOns as any) || {};
    currentAddOns[addOnId] = {
      activatedAt: new Date().toISOString(),
      active: true,
    };

    await prisma.client.update({
      where: { id: clientId },
      data: { addOns: currentAddOns },
    });

    await discordService.notify(
      `💰 ADD-ON ACTIVATED\n\nClient: ${client.businessName}\nAdd-on: ${addOnId}\nPlan: ${client.planType.toUpperCase()}`
    );

    logger.info(`Add-on ${addOnId} activated for ${client.businessName}`);
    return { success: true, addOnId };
  }

  // ═══════════════════════════════════════════════════════════
  // POST-TRIAL FLOW: Generate invoice + send payment link
  // Called by CRON when trial ends
  // ═══════════════════════════════════════════════════════════
  async processTrialConversion(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || !client.isTrial) return;

    const pkg = PACKAGES[client.planType] || PACKAGES.basic;
    const paymentLink = this.getPaymentLink(client.planType);

    // Send invoice email with payment link + contract
    await emailService.sendTrialEndInvoiceEmail({
      to: client.contactEmail,
      contactName: client.contactName,
      businessName: client.businessName,
      planType: client.planType,
      packageName: pkg.name,
      monthlyPrice: pkg.monthlyFee,
      setupPrice: pkg.setupFee,
      paymentLink: `${paymentLink}?client_reference_id=${client.id}`,
      dashboardUrl: `${env.FRONTEND_URL}/client-portal/${clientId}?token=${client.dashboardToken}`,
      trialStats: await this.getTrialSummaryStats(clientId),
    });

    // Schedule deactivation reminder at J+3 if no payment
    await prisma.reminder.create({
      data: {
        targetType: 'client',
        targetId: client.id,
        reminderType: 'payment_overdue_3days',
        scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    // Schedule hard deactivation at J+7
    await prisma.reminder.create({
      data: {
        targetType: 'client',
        targetId: client.id,
        reminderType: 'account_deactivation',
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info(`Trial conversion email sent for ${client.businessName}`);
  }

  // ═══════════════════════════════════════════════════════════
  // HARD DEACTIVATION - No payment after grace period
  // ═══════════════════════════════════════════════════════════
  async hardDeactivateClient(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return;

    // Check if payment was made in the meantime
    if (client.subscriptionStatus === 'active') {
      logger.info(`Client ${client.businessName} already converted, skipping deactivation`);
      return;
    }

    // Deactivate everything
    await onboardingService.deactivateClient(clientId);

    await prisma.client.update({
      where: { id: clientId },
      data: {
        subscriptionStatus: 'canceled',
        cancellationDate: new Date(),
        dashboardToken: null, // Revoke dashboard access
      },
    });

    // Send final deactivation email
    await emailService.sendAccountDeactivatedEmail({
      to: client.contactEmail,
      contactName: client.contactName,
      businessName: client.businessName,
    });

    await discordService.notify(
      `🔒 ACCOUNT DEACTIVATED (no payment)\n\nClient: ${client.businessName}\nPlan was: ${client.planType.toUpperCase()}\nDashboard access revoked\nVAPI assistant deleted`
    );

    logger.info(`Hard deactivation: ${client.businessName} (no payment after trial)`);
  }

  // ═══════════════════════════════════════════════════════════
  // TRIAL SUMMARY STATS - Used in trial-end invoice email
  // ═══════════════════════════════════════════════════════════
  private async getTrialSummaryStats(clientId: string): Promise<TrialStats> {
    const [totalCalls, totalBookings, totalLeads] = await Promise.all([
      prisma.clientCall.count({ where: { clientId } }),
      prisma.clientBooking.count({ where: { clientId } }),
      prisma.clientCall.count({ where: { clientId, isLead: true } }),
    ]);

    return { totalCalls, totalBookings, totalLeads };
  }

  private getPaymentLink(planType: string): string {
    switch (planType) {
      case 'basic': return env.STRIPE_LINK_BASIC;
      case 'pro': return env.STRIPE_LINK_PRO;
      case 'enterprise': return env.STRIPE_LINK_ENTERPRISE;
      default: return env.STRIPE_LINK_BASIC;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[];
  section: string;
}

interface OnboardingFormTemplate {
  businessType: string;
  planType: string;
  packageName: string;
  sections: { id: string; title: string; description: string }[];
  fields: FormField[];
}

interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
}

interface TrialStats {
  totalCalls: number;
  totalBookings: number;
  totalLeads: number;
}

export const onboardingFlowService = new OnboardingFlowService();
