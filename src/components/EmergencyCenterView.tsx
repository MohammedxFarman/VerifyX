import { Shield, Phone, ExternalLink, HelpCircle, CheckCircle, FileText, AlertOctagon } from "lucide-react";

export default function EmergencyCenterView() {
  const helplineGroups = [
    {
      title: "Primary Digital Crime Helplines",
      items: [
        {
          name: "National Cyber Crime Helpline Number",
          id: "tel-1930",
          phone: "1930",
          desc: "Dial immediately if you have been scammed. Coordinates directly with banking cells to freeze fund routing.",
          isPrimary: true
        },
        {
          name: "National Cyber Crime Reporting Portal",
          link: "https://www.cybercrime.gov.in",
          desc: "Official Government portal to submit formal trace statements, upload scam screenshots, and file FIRs.",
        },
        {
          name: "CERT-In (Computer Emergency Response Team)",
          link: "https://www.cert-in.org.in",
          desc: "National authority responding to server network intrusions, phishing chains, ransomware, and high severity digital compromises."
        }
      ]
    },
    {
      title: "State Public Emergency Numbers",
      items: [
        { name: "Police Emergency Network", phone: "112", desc: "Universal national emergency response service." },
        { name: "Women Helpline Cell", phone: "1091", desc: "Safety counseling and support helpline." },
        { name: "Child Safety Helpline", phone: "1098", desc: "National helpline for child rescue and welfare support." }
      ]
    }
  ];

  const safetyGuides = [
    {
      title: "Financial Scam Remediation Steps",
      steps: [
        "DO NOT panic. Immediate speed is your most critical leverage.",
        "Dial 1930 from your registered phone within 2 hours of the transaction.",
        "Provide your banker name, account number, UPI reference ID, and transaction sums.",
        "The operator files an online hold requesting the receiving merchants to freeze the wallet payouts.",
        "Log on to cybercrime.gov.in to save formal screenshots and transaction statements."
      ]
    },
    {
      title: "Responding to Sextortion / Identity Impersonation",
      steps: [
        "Cease all communications immediately. Do not build threads with the actor.",
        "DO NOT pay any ransom sum; extortionists will multiply demands indefinitely.",
        "Take explicit high-contrast screenshots of the profiles, phone handles, and banking credentials.",
        "Report the handles to the respective social platform support tools immediately.",
        "Submit screenshots directly to the Cyber Crime cell. India preserves anonymous reporting protocols for harassment cases."
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      {/* Helpline Contact Lists left side */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-2 text-rose-500 mb-3">
            <AlertOctagon className="h-5 w-5 animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">Indian National Emergency Desk</span>
          </div>

          <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-2">Emergency Response Hub</h2>
          <p className="text-gray-500 text-xs leading-relaxed mb-6">
            If you have been scammed, defrauded, or targeted in digital harassment campaigns in India, execute immediate reporting steps listed below.
          </p>

          <div className="space-y-6">
            {helplineGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-3">
                <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">{group.title}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.items.map((item, iIdx) => (
                    <div
                      key={iIdx}
                      className={`border rounded-xl p-4 flex flex-col justify-between transition-colors ${
                        (item as any).isPrimary 
                          ? "bg-rose-50/50 border-rose-100 shadow-sm" 
                          : "bg-white border-gray-150 hover:border-gray-300"
                      }`}
                    >
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 leading-tight">{item.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                        {item.phone ? (
                          <a
                            href={`tel:${item.phone}`}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-mono font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Dial {item.phone}
                          </a>
                        ) : (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 font-bold text-xs flex items-center gap-1"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Website
                          </a>
                        )}
                        <span className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-wider">OFFICIAL MINISTRY LINK</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Safety Instructions Guides right side */}
      <div className="lg:col-span-1 space-y-4">
        {safetyGuides.map((guide, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 text-blue-600 mb-3">
              <FileText className="h-4 w-4" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider">National Security Guide</span>
            </div>

            <h3 className="text-sm font-bold text-gray-800 tracking-tight leading-tight mb-3">
              {guide.title}
            </h3>

            <ol className="space-y-3">
              {guide.steps.map((step, sIdx) => (
                <li key={sIdx} className="flex gap-2.5 items-start">
                  <span className="h-5 w-5 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-mono text-[10px] font-black flex-shrink-0 mt-0.5">
                    {sIdx + 1}
                  </span>
                  <span className="text-xs text-gray-600 leading-normal">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
