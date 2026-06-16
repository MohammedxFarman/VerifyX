import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      nav: {
        digital_trust_core: "Digital Trust Core",
        cyber_safety_portal_live: "INDIAN CYBER SAFETY PORTAL LIVE (1930)",
        get_started: "Get Started",
        configure_api_keys: "Configure API Keys",
        logout: "Logout"
      },
      tabs: {
        dashboard: "Dashboard",
        news: "AI Fake News",
        website: "Website Scan",
        image: "AI Image Unit",
        profile: "Social Persona",
        plagiarism: "Plagiarism Unit",
        chat: "AI Support Buddy",
        emergency: "Helpline Desk (IND)",
        profile_keys: "Audit Logs & Trace"
      },
      dashboard: {
        enterprise_public_trust: "ENTERPRISE PUBLIC TRUST SYSTEM",
        title: "Verify Everything. Trust Confidently.",
        description: "Ensure truth and protection against misinformation, AI-generated fraud, social profile impersonation, and fraudulent payment portals. Powered by Gemini 3.5 AI Core.",
        check_news: "Check News Authenticity",
        scan_scams: "Scan Scams / URLs",
        kpi_scans: "TRUST AUDIT SCANS",
        kpi_trust_value: "VERIFYX TRUST VALUE",
        kpi_detected_threats: "DETECTED THREATS",
        kpi_actionable: "Actionable",
        kpi_telemetry: "FORENSIC TELEMETRY",
        kpi_active: "Active",
        trends_title: "Weekly Public Safety Trends",
        distribution_title: "Categorical Threats distribution",
        recent_audit_logs: "RECIPIENT / RECENT AUDIT LOGS",
        recent_desc: "Live trace record of verified communication items inside this server run."
      },
      footer: {
        platform: "VerifyX platform",
        copyright: "© 2026 VerifyX. Verify Everything. Trust Confidently.",
        secure_shell: "SECURE SHELL v1.0.0"
      },
      common: {
        language: "Language",
        english: "English",
        hindi: "Hindi",
        search: "Search...",
        loading: "Loading..."
      }
    }
  },
  hi: {
    translation: {
      nav: {
        digital_trust_core: "डिजिटल ट्रस्ट कोर",
        cyber_safety_portal_live: "भारतीय साइबर सुरक्षा पोर्टल लाइव (1930)",
        get_started: "शुरू करें",
        configure_api_keys: "एपीआई कुंजियाँ कॉन्फ़िगर करें",
        logout: "लॉगआउट"
      },
      tabs: {
        dashboard: "डैशबोर्ड",
        news: "एआई नकली समाचार",
        website: "वेबसाइट स्कैन",
        image: "एआई इमेज यूनिट",
        profile: "सोशल व्यक्तित्व",
        plagiarism: "साहित्यिक चोरी इकाई",
        chat: "एआई सहायता मित्र",
        emergency: "हेल्पलाइन डेस्क (IND)",
        profile_keys: "ऑडिट लॉग और ट्रैस"
      },
      dashboard: {
        enterprise_public_trust: "एंटरप्राइज पब्लिक ट्रस्ट सिस्टम",
        title: "सब कुछ सत्यापित करें। विश्वास के साथ भरोसा करें।",
        description: "गलत सूचना, एआई-जनित धोखाधड़ी, सामाजिक प्रोफ़ाइल प्रतिरूपण और धोखाधड़ी वाले भुगतान पोर्टलों के खिलाफ सच्चाई और सुरक्षा सुनिश्चित करें। जेमिनी 3.5 एआई कोर द्वारा संचालित।",
        check_news: "समाचार प्रामाणिकता जांचें",
        scan_scams: "स्कैम / यूआरएल स्कैन करें",
        kpi_scans: "ट्रस्ट ऑडिट स्कैन",
        kpi_trust_value: "सत्यापनएक्स ट्रस्ट मूल्य",
        kpi_detected_threats: "पता लगाए गए खतरे",
        kpi_actionable: "कार्रवाई योग्य",
        kpi_telemetry: "फोरेंसिक टेलीमेट्री",
        kpi_active: "सक्रिय",
        trends_title: "साप्ताहिक सार्वजनिक सुरक्षा रुझान",
        distribution_title: "श्रेणीबद्ध खतरों का वितरण",
        recent_audit_logs: "हाल के ऑडिट लॉग",
        recent_desc: "इस सर्वर रन के भीतर सत्यापित संचार मदों का लाइव ट्रेस रिकॉर्ड।"
      },
      footer: {
        platform: "सत्यापनएक्स प्लेटफॉर्म",
        copyright: "© 2026 VerifyX. सब कुछ सत्यापित करें। विश्वास के साथ भरोसा करें।",
        secure_shell: "सुरक्षित शेल v1.0.0"
      },
      common: {
        language: "भाषा",
        english: "अंग्रेजी",
        hindi: "हिन्दी",
        search: "खोजें...",
        loading: "लोड हो रहा है..."
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
