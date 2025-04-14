/**
 * Sample document content for demonstration
 * In a real implementation, this would be retrieved from a document store
 */

// Key is document ID, value is array of passages from the document
export const documentContent: Record<string, string[]> = {
  "doc_123456": [
    "Machine learning is a subset of artificial intelligence that focuses on developing systems that can learn from and make decisions based on data.",
    "Supervised learning involves training a model on a labeled dataset, where the model learns to predict the output from the input data.",
    "Unsupervised learning involves training a model on an unlabeled dataset, where the model learns patterns and relationships in the data without specific guidance.",
    "Common machine learning algorithms include decision trees, random forests, support vector machines, and neural networks.",
    "Feature engineering is the process of selecting and transforming variables when creating a predictive model using machine learning or statistical modeling."
  ],
  "doc_789012": [
    "Global temperatures have risen by an average of 1.1°C since the pre-industrial era, with the last decade being the warmest on record.",
    "Sea levels continue to rise at an accelerating rate due to thermal expansion and ice melt from glaciers and ice sheets.",
    "Carbon dioxide levels in the atmosphere have increased by over 45% since the industrial revolution, primarily due to human activities.",
    "The Paris Agreement aims to limit global warming to well below 2°C, preferably to 1.5°C, compared to pre-industrial levels.",
    "Climate change mitigation strategies include transitioning to renewable energy sources, improving energy efficiency, and enhancing carbon sinks."
  ],
  "doc_345678": [
    "Quantum computing uses quantum bits or qubits, which can exist in multiple states simultaneously due to superposition.",
    "Quantum entanglement allows qubits to be correlated in ways that cannot be explained by classical physics, enabling unique computational capabilities.",
    "Quantum algorithms like Shor's algorithm for factoring large numbers and Grover's algorithm for searching unsorted databases offer exponential and quadratic speedups, respectively.",
    "Quantum error correction is essential for building practical quantum computers due to the fragility of quantum states and susceptibility to noise.",
    "Major challenges in quantum computing include maintaining quantum coherence, scaling up the number of qubits, and developing fault-tolerant systems."
  ],
  "doc_901234": [
    "Solar photovoltaic technology converts sunlight directly into electricity and has seen efficiency improvements from under 10% to over 25% in commercial panels.",
    "Wind energy is one of the fastest-growing renewable energy sources, with modern turbines capable of generating up to 15 MW of power.",
    "Hydroelectric power remains the largest source of renewable electricity globally, accounting for about 16% of total electricity production.",
    "Energy storage technologies, particularly lithium-ion batteries, have experienced dramatic cost reductions of over 90% in the past decade.",
    "Green hydrogen produced using renewable electricity is emerging as a promising solution for decarbonizing industrial processes and long-distance transportation."
  ],
  "doc_567890": [
    "AI ethics encompasses principles such as fairness, transparency, privacy, accountability, and beneficence in the development and deployment of AI systems.",
    "Algorithmic bias can perpetuate and amplify existing social inequalities if training data contains historical biases or if the algorithm design is flawed.",
    "Explainable AI (XAI) focuses on making AI systems' decisions interpretable and understandable to humans, especially in high-stakes contexts.",
    "Privacy-preserving techniques like federated learning and differential privacy allow AI models to learn from sensitive data without direct access to it.",
    "AI governance frameworks are being developed at organizational, national, and international levels to ensure responsible AI development and deployment."
  ]
};