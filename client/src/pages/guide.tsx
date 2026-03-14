import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Rocket,
  Lightbulb,
  LayoutPanelLeft,
  Bot,
  GitFork,
  FileText,
  Package,
  ShieldCheck,
  Settings,
  Upload,
  Cloud,
  Layers,
} from "lucide-react";
import type { UserRole } from "@shared/schema";

interface GuideSection {
  id: string;
  title: string;
  icon: typeof Rocket;
  roles: UserRole[] | "all";
  content: () => JSX.Element;
}

function canView(section: GuideSection, role: UserRole): boolean {
  if (section.roles === "all") return true;
  return section.roles.includes(role);
}

const sections: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Rocket,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Getting Started</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          CannonBall is an AI-powered automation pipeline that takes a raw process idea and transforms it into a fully documented, export-ready robotic process automation (RPA) package. The platform guides you through every stage of the journey\u2014from initial idea submission through AI-assisted discovery, process mapping, document generation, and finally UiPath export\u2014so that your team can move from concept to deployment with minimal friction.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          To get started, log in with the credentials provided by your administrator. Once authenticated, you will land on the Pipeline board where you can see all submitted ideas across 9 stages: Idea, Design, Feasibility Assessment, Build, Test, Governance / Security Scan, CoE Approval, Deploy, and Maintenance. Each stage represents a milestone in the automation lifecycle, and ideas advance through these stages automatically as criteria are met or via CoE/Admin approval.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Your experience within CannonBall depends on your assigned role. Process SMEs focus on creating ideas and working through the AI-assisted discovery process. CoE (Centre of Excellence) members review and approve deliverables at each gate. Administrators have full access to user management, audit logs, and system configuration. You can see your current role in the top navigation bar at any time.
        </p>
      </>
    ),
  },
  {
    id: "creating-idea",
    title: "Creating an Idea",
    icon: Lightbulb,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Creating an Idea</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          To create a new automation idea, click the &ldquo;New Idea&rdquo; button found on the Ideas dashboard. A modal will appear prompting you to enter a title, a description of the process you want to automate, and one or more tags to categorize the idea. The title should be concise yet descriptive\u2014something like &ldquo;Invoice Processing Automation&rdquo; or &ldquo;Employee Onboarding Workflow.&rdquo; The description field is where you provide context about the current manual process, the pain points, and the expected outcome of automating it.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          After you submit the idea, it enters the Idea stage. At this point, it appears on your Ideas dashboard and is visible to CoE reviewers. You can open the idea at any time to continue working on it. When you are ready to begin the AI-assisted discovery process, open the idea&rsquo;s workspace. The system will automatically transition the idea into the Design stage once you have 3 or more process steps and 4 or more messages in the conversation with the AI assistant. After the As-Is map is approved, the idea advances to the Feasibility Assessment stage where the automation type is evaluated and the To-Be map is generated.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Tags help your organization filter and prioritize ideas. Common tags include the department name, process category (e.g., Finance, HR, IT), and estimated complexity. You can add or modify tags later from the idea detail view. Well-tagged ideas make it easier for CoE reviewers to triage incoming submissions and allocate review bandwidth effectively.
        </p>
      </>
    ),
  },
  {
    id: "workspace",
    title: "The Workspace",
    icon: LayoutPanelLeft,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">The Workspace</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The Workspace is the primary environment where you develop your automation idea. It uses a three-panel layout designed for maximum productivity. On the left is the Stage Tracker, which shows the current pipeline stage and provides a visual indicator of progress through the automation lifecycle. In the center is the Process Map panel, where a live visual diagram of your process is built and refined in real time. On the right is the AI Chat panel, where you converse with the AI assistant to discover and document your process steps.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          All three panels are resizable. You can drag the dividers between panels to allocate more screen space to whichever area you need at the moment. For example, when you are focused on chatting with the AI, you might expand the chat panel and collapse the process map. When reviewing the map in detail, you can expand the center panel. The layout state persists for the duration of your session so you do not need to readjust every time you navigate away and back.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          The workspace also includes contextual action buttons at the top of each panel. From the process map panel header, you can trigger map approval, export actions, or zoom controls. The chat panel header shows the current conversation topic and provides a button to clear the chat history if you want to start a fresh discovery session. All workspace actions respect your role permissions\u2014certain approval and export actions are only available to CoE members and administrators.
        </p>
      </>
    ),
  },
  {
    id: "ai-assistant",
    title: "Working with the AI Assistant",
    icon: Bot,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Working with the AI Assistant</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The AI assistant is at the heart of the CannonBall discovery process. It leads the conversation by asking targeted questions about your manual process, guiding you through each step systematically. You do not need to know the &ldquo;right&rdquo; way to describe a process\u2014simply answer the AI&rsquo;s questions in plain language, and it will extract the structured information needed to build your process map and documentation.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          As the conversation progresses, the AI emits special <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">[STEP:]</code> tags in its responses. These tags are automatically parsed by the system and used to create new nodes on the process map in the center panel. You will see the map update in real time as the AI identifies tasks, decisions, and sub-processes. This tight feedback loop lets you validate the AI&rsquo;s understanding instantly\u2014if a step looks wrong on the map, you can correct it in the chat right away.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          For best results, provide specific details when answering the AI&rsquo;s questions. Mention the applications involved (e.g., SAP, Excel, email), the data fields being manipulated, and any business rules or exceptions that apply. The more context you give, the more accurate and complete your process map will be. If the AI asks a question you are unsure about, it is perfectly fine to say so\u2014it will adapt and move on to the next area of inquiry. You can also upload documents (DOCX, PDF, XLSX, TXT, CSV) directly into the chat to provide the AI with existing process documentation\u2014see the File Upload &amp; Extraction section for details.
        </p>
      </>
    ),
  },
  {
    id: "process-maps",
    title: "Process Maps",
    icon: GitFork,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Process Maps</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Process maps in CannonBall use standard flowchart conventions to represent your automation workflow. Start and End nodes are displayed as rounded pills, task steps appear as rectangles, and decision points are rendered as diamond shapes. Edges (arrows) connect nodes to show the flow of execution, and each edge can carry a label such as &ldquo;Yes&rdquo; or &ldquo;No&rdquo; to indicate the outcome of a decision. The map is built automatically from the AI conversation but can be manually refined at any time.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          To edit a node, click on it to select it, then modify the label text inline. You can right-click anywhere on the canvas to open a context menu that lets you add new nodes, delete selected nodes, or change the node type. Edges can be created by dragging from one node&rsquo;s output handle to another node&rsquo;s input handle. To label an edge, click on it and type the desired text. All changes are saved automatically and synchronized with the server in real time.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Once you are satisfied that the process map accurately represents the workflow, you can submit it for approval. The approval workflow routes the map to a CoE reviewer who will verify correctness, suggest changes, or approve it. Upon approval, the system begins generating the Process Design Document (PDD) based on the approved map structure. Once the PDD is generated, the idea automatically transitions to the Build stage, where technical specifications can be developed.
        </p>
      </>
    ),
  },
  {
    id: "documents",
    title: "Documents (PDD & SDD)",
    icon: FileText,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Documents (PDD &amp; SDD)</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          CannonBall automatically generates two key documents for every automation idea: the Process Design Document (PDD) and the Solution Design Document (SDD). The PDD is created after the process map is approved and describes the business process in detail\u2014including the scope, stakeholders, process steps, business rules, and exceptions. It serves as the functional specification that business analysts and process owners review and sign off on.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The SDD is generated after the PDD is approved and provides the technical specification for the RPA developer. It includes detailed descriptions of each automation step, the applications and screens involved, data mappings, error handling logic, and any custom code or API integrations required. Together, the PDD and SDD form a complete handoff package from business requirements to technical implementation.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Both documents go through an approval workflow. CoE reviewers can approve the document as-is, or request revisions with specific feedback. When revisions are requested, the document is regenerated with the updated information. Every version is tracked, so you can compare changes between versions and maintain a complete audit trail of the document&rsquo;s evolution from first draft to final approval.
        </p>
      </>
    ),
  },
  {
    id: "uipath-export",
    title: "UiPath Export",
    icon: Package,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">UiPath Export</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          After the SDD is approved, CannonBall can generate a UiPath-compatible export package. This package contains a <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">project.json</code> file that defines the UiPath project structure, XAML stub files for each automation sequence identified in the process map, and a README file with setup instructions and context about the process being automated.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The XAML stubs are pre-populated with activity placeholders that correspond to the steps in your process map. While they are not fully executable out of the box, they provide a significant head start for your RPA developers by establishing the correct sequence structure, naming conventions, and placeholder variables. Developers can open the project directly in UiPath Studio and begin implementing the detailed automation logic within the provided framework.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          The UiPath export is triggered from the workspace after the SDD is approved and the idea reaches the Test stage. Click the export button in the process map panel header, and the system will generate the package as a downloadable ZIP file. The package is also stored on the server for future reference and can be re-downloaded at any time from the idea&rsquo;s detail view. After the export is complete, the idea advances through Governance / Security Scan, CoE Approval, Deploy, and finally to Maintenance, marking the end of the automation pipeline.
        </p>
      </>
    ),
  },
  {
    id: "file-upload",
    title: "File Upload & Extraction",
    icon: Upload,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">File Upload &amp; Content Extraction</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          CannonBall supports uploading documents directly into the AI Chat panel to accelerate the automation pipeline. Instead of manually describing a process, you can upload an existing document&mdash;such as a process description, standard operating procedure, or data spreadsheet&mdash;and the AI will automatically extract the content and use it to drive the pipeline forward.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Supported file types include <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">DOCX</code>, <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">PDF</code>, <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">XLSX</code>/<code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">XLS</code>, <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">TXT</code>, and <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">CSV</code>. When you upload one of these files, the system extracts the text content on the server side and injects it into the chat context. The AI then analyzes the content for process steps, business rules, decision points, roles, systems, and exceptions&mdash;and can automatically generate process map steps from the document.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          You can also upload images (<code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">PNG</code>, <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">JPG</code>, <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">GIF</code>, <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">WEBP</code>) and videos (<code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">MP4</code>, <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">WEBM</code>, <code className="text-cb-teal bg-card px-1.5 py-0.5 rounded-md text-sm">MOV</code>). Since these cannot be parsed as text, the AI will prompt you to describe the process or steps shown in the media so it can incorporate that information.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          To upload a file, click the paperclip icon in the chat input area, select your file, and optionally type a message to accompany it. The system will show a loading spinner while extracting content, and then send everything to the AI in a single message. This is especially powerful for bootstrapping a new idea&mdash;upload a PDD or process description and the AI can immediately begin building the process map and generating documentation.
        </p>
      </>
    ),
  },
  {
    id: "deployment",
    title: "UiPath Deployment",
    icon: Cloud,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">UiPath Orchestrator Deployment</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          After the SDD is approved, CannonBall can deploy your automation directly to UiPath Orchestrator. The deployment process is conversational&mdash;simply tell the AI to deploy, and it will provision all necessary Orchestrator artifacts automatically. This includes queues, assets (text, integer, boolean, and credential types), machines, triggers (both queue-based and time-based), storage buckets, environments, robot accounts, Action Center task catalogs, and Document Understanding projects.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The system intelligently probes your Orchestrator tenant to determine which services are available before attempting deployment. If a service like Action Center or Test Manager is not enabled on your tenant, the system will skip those artifacts and report this in the deployment results rather than failing. All deployment results are displayed in an inline report card within the chat, showing the status of each artifact (created, already exists, skipped, or failed).
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          <strong>Test Manager Integration:</strong> The deployment includes full Test Manager V2 API support. A test project is created for your automation, and individual test cases are provisioned with labels (Critical, Smoke, Regression) and manual steps. Test data queues can also be created and populated with test data items for data-driven testing scenarios.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          <strong>Connection Settings:</strong> Before deploying, configure your UiPath Orchestrator connection settings from the Settings page. You will need your Orchestrator URL, tenant name, organization name, Client ID, and Client Secret. The system uses OAuth2 client credentials to authenticate and supports both Cloud and on-premises Orchestrator instances.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Deployment results are persistent&mdash;they are saved in the chat history and can be reviewed at any time by scrolling back through the conversation. The deployment report card shows a summary with counts of created, existing, skipped, and failed artifacts, along with detailed status for each individual item.
        </p>
      </>
    ),
  },
  {
    id: "process-map-levels",
    title: "Process Map Levels",
    icon: Layers,
    roles: "all",
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Process Map Detail Levels</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          CannonBall supports multiple levels of process map detail, allowing you to view your automation at different granularities. The process map panel includes view tabs that let you switch between these levels:
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          <strong>As-Is Map:</strong> This is the current-state process map that documents how the process works today, before automation. It captures every manual step, decision point, role, and system interaction. The As-Is map is built collaboratively with the AI during the discovery phase and serves as the foundation for the Process Design Document (PDD).
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          <strong>To-Be Map:</strong> The future-state process map shows how the process will work after automation. It highlights which steps are automated vs. manual, where human-in-the-loop interventions occur, and how the automation interacts with systems. The To-Be map reflects the design decisions captured in the PDD and helps stakeholders visualize the automated workflow.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          <strong>SDD View:</strong> The technical implementation view provides a developer-oriented perspective of the automation. It maps directly to the Solution Design Document and shows the technical sequences, API calls, application interactions, and error handling paths that the RPA developer will implement in UiPath Studio.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          All map views share the same interactive controls: zoom in/out, fit-to-view, right-click context menus for adding or removing nodes, inline label editing, drag-and-drop repositioning, and edge label editing. Maps are automatically laid out using a directed acyclic graph (DAG) algorithm for clean visual presentation, with intelligent branching for decision nodes and parallel paths.
        </p>
      </>
    ),
  },
  {
    id: "coe-review",
    title: "CoE Review Workflow",
    icon: ShieldCheck,
    roles: ["CoE", "Admin"],
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">CoE Review Workflow</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          As a Centre of Excellence (CoE) member, you play a critical role in ensuring the quality and accuracy of automation deliverables. When a Process SME submits a process map, PDD, or SDD for approval, it appears in your review queue. You can access pending reviews from the Ideas dashboard by filtering for items awaiting CoE review, or through notification alerts that appear when new items are submitted.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          For each review, you can examine the deliverable in detail, compare it against previous versions if applicable, and either approve it or request revisions. When requesting revisions, provide specific and actionable feedback so the Process SME knows exactly what needs to change. Your feedback is attached to the deliverable and visible to the submitter in their workspace. Once revisions are made, the item returns to your queue for re-review.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Every approval and rejection action is captured in the system&rsquo;s audit trail. This includes the reviewer&rsquo;s identity, timestamp, decision, and any comments provided. The audit trail provides full traceability for compliance and governance purposes, ensuring that every automation deliverable has been properly vetted before moving to the next pipeline stage. Administrators can view the complete audit history from the Settings page.
        </p>
      </>
    ),
  },
  {
    id: "administration",
    title: "Administration",
    icon: Settings,
    roles: ["Admin"],
    content: () => (
      <>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Administration</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The Administration section is available exclusively to users with the Admin role. From here, you can manage user accounts, including creating new users, deactivating existing accounts, and assigning or changing roles. Role assignments determine what each user can see and do within CannonBall\u2014Process SMEs can create and develop ideas, CoE members can review and approve deliverables, and Administrators have full system access.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The audit log provides a comprehensive record of all significant actions taken within the system. This includes user logins, idea submissions, stage transitions, approval decisions, document generations, and export events. Each log entry includes the user who performed the action, the timestamp, the affected resource, and a description of what changed. You can filter and search the audit log by date range, user, action type, or resource.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          System monitoring tools allow you to track platform health and usage metrics. You can view active user counts, the number of ideas in each pipeline stage, document generation statistics, and system performance indicators. These insights help you identify bottlenecks in the automation pipeline, allocate CoE review capacity, and ensure the platform is operating efficiently for your organization.
        </p>
      </>
    ),
  },
];

export default function Guide() {
  const { activeRole } = useAuth();
  const isMobile = useIsMobile();
  const visibleSections = sections.filter((s) => canView(s, activeRole));
  const [activeId, setActiveId] = useState(visibleSections[0]?.id ?? "getting-started");

  const activeSection = visibleSections.find((s) => s.id === activeId) ?? visibleSections[0];

  return (
    <div className="flex flex-col sm:flex-row h-full" data-testid="page-guide">
      <nav
        className={`shrink-0 border-b sm:border-b-0 sm:border-r border-border ${
          isMobile
            ? "flex gap-1 p-2 overflow-x-auto"
            : "w-[200px] flex flex-col gap-1 p-3 overflow-y-auto"
        }`}
        data-testid="guide-nav"
      >
        {!isMobile && (
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
            User Guide
          </h3>
        )}
        {visibleSections.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              onClick={() => setActiveId(section.id)}
              data-testid={`guide-nav-${section.id}`}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 rounded-md text-xs sm:text-sm text-left transition-colors whitespace-nowrap ${
                isMobile ? "" : "w-full"
              } ${
                isActive
                  ? "bg-cb-gold/15 text-cb-gold font-medium"
                  : "text-muted-foreground hover-elevate"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${isActive ? "text-cb-gold" : ""}`} />
              <span className="truncate">{section.title}</span>
            </button>
          );
        })}
      </nav>

      <ScrollArea className="flex-1">
        <div
          className="max-w-3xl p-4 sm:p-8"
          data-testid={`guide-content-${activeSection?.id}`}
        >
          {activeSection?.content()}
        </div>
      </ScrollArea>
    </div>
  );
}
