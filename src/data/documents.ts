/**
 * Sample document metadata for demonstration
 */

// Document metadata interface matching the required structure
export interface DocumentMetadata {
  id: string;
  filename: string;
  title: string;
  author: string;
  publicationDate: string;
  tags: string[];
  pageCount: number;
  language: string;
  description: string;
}

// Sample document data for demonstration
export const sampleDocuments: DocumentMetadata[] = [
  {
    id: "doc_123456",
    filename: "machine_learning_basics.pdf",
    title: "Introduction to Machine Learning",
    author: "Dr. Sarah Johnson",
    publicationDate: "2022-03-15",
    tags: ["machine learning", "AI", "introduction", "data science"],
    pageCount: 42,
    language: "en",
    description: "A comprehensive introduction to machine learning concepts, algorithms, and applications."
  },
  {
    id: "doc_789012",
    filename: "climate_change_report.pdf",
    title: "Global Climate Change: Annual Report 2023",
    author: "International Climate Institute",
    publicationDate: "2023-01-10",
    tags: ["climate", "environment", "research", "global warming"],
    pageCount: 128,
    language: "en",
    description: "Annual summary of global climate research, trends, and policy recommendations."
  },
  {
    id: "doc_345678",
    filename: "quantum_computing.pdf",
    title: "Quantum Computing: Principles and Challenges",
    author: "Dr. Michael Chen",
    publicationDate: "2021-11-30",
    tags: ["quantum", "computing", "physics", "technology"],
    pageCount: 86,
    language: "en",
    description: "Explores the fundamental principles of quantum computing and current research challenges."
  },
  {
    id: "doc_901234",
    filename: "renewable_energy.pdf",
    title: "Renewable Energy Technologies: Current State and Future Prospects",
    author: "Energy Research Consortium",
    publicationDate: "2022-08-22",
    tags: ["energy", "renewable", "sustainability", "technology"],
    pageCount: 105,
    language: "en",
    description: "Overview of current renewable energy technologies, efficiency metrics, and future development paths."
  },
  {
    id: "doc_567890",
    filename: "artificial_intelligence_ethics.pdf",
    title: "Ethical Considerations in AI Development",
    author: "Dr. Emma Roberts",
    publicationDate: "2023-02-18",
    tags: ["AI", "ethics", "policy", "governance"],
    pageCount: 64,
    language: "en",
    description: "Analysis of ethical frameworks, challenges, and recommendations for responsible AI development."
  }
];