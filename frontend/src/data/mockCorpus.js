export const THEMES = [
  { id: 'obsidian', name: 'Obsidian Mono', dot: '#ffffff', icon: 'Circle' },
  { id: 'sakura', name: 'Sakura Pink', dot: '#f472b6', icon: 'Flower2' },
  { id: 'nord', name: 'Nord Frost', dot: '#38bdf8', icon: 'Snowflake' },
  { id: 'lavender', name: 'Lavender Haze', dot: '#a78bfa', icon: 'Heart' },
]

export const MEMORY_SPARKS = [
  {
    id: 1,
    course: 'OS notes',
    term: 'Mutex',
    question: 'Do you remember what a Mutex is from your OS notes?',
    answer:
      'A Mutual Exclusion (Mutex) lock is a synchronization primitive that ensures only one thread can access a critical section or shared resource at a time, preventing race conditions.',
  },
  {
    id: 2,
    course: 'OS notes',
    term: 'Virtual Memory',
    question: 'How does Demand Paging reduce process startup latency?',
    answer:
      'Demand paging loads pages into physical RAM only when they are referenced (on page fault), rather than loading the entire process image at startup.',
  },
  {
    id: 3,
    course: 'Biology notes',
    term: 'Photosynthesis',
    question: 'What role does Chlorophyll play in the light-dependent reactions?',
    answer:
      'Chlorophyll absorbs photons (primarily red and blue wavelengths) inside thylakoid membranes to excite electrons, powering ATP and NADPH synthesis.',
  },
  {
    id: 4,
    course: 'Physics notes',
    term: 'Law of Inertia',
    question: "What does Newton's First Law state about an object in uniform motion?",
    answer:
      'An object remains at rest or in uniform motion in a straight line unless acted upon by a net external force.',
  },
]

export const COURSES_MASTERY = [
  { code: 'CS-301', title: 'Operating Systems', progress: 82, chapter: 'Chapter 6: Concurrency & Locks' },
  { code: 'CS-402', title: 'Machine Learning', progress: 64, chapter: 'Chapter 3: Gradient Descent & Loss' },
  { code: 'CS-510', title: 'Database Internals', progress: 90, chapter: 'Chapter 8: B+ Trees & WAL' },
  { code: 'CS-305', title: 'Computer Networks', progress: 75, chapter: 'Chapter 4: TCP Handshake & BBR' },
  { code: 'BIO-101', title: 'Cellular Biology', progress: 58, chapter: 'Chapter 5: Photosynthesis & Calvin' },
]

export const INITIAL_DOCUMENTS = [
  {
    document_id: 1,
    filename: 'Operating_Systems.pdf',
    pages: 48,
    ingested: true,
    subject: 'CS-301',
    sections: [
      {
        page: 14,
        heading: 'Processes & Scheduling',
        text: 'A process is a program in execution with its own address space, stack, and Process Control Block (PCB). Preemptive schedulers such as Round Robin allocate fixed time quanta to guarantee responsiveness.',
      },
      {
        page: 28,
        heading: 'Concurrency, Mutexes & Semaphores',
        text: 'A mutex (mutual exclusion lock) enforces strict ownership so only the thread that acquires the lock can release it. Semaphores maintain an integer counter to coordinate access to pools of resources and avoid race conditions.',
      },
      {
        page: 35,
        heading: 'Deadlocks & Banker Algorithm',
        text: 'A deadlock arises when four Coffman conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait. Breaking any one condition prevents deadlock.',
      },
      {
        page: 42,
        heading: 'Virtual Memory & Paging',
        text: 'Virtual memory decouples logical addresses from physical RAM frames using page tables and the Translation Lookaside Buffer (TLB). When a referenced page is absent from RAM, a page fault triggers demand paging from disk.',
      },
    ],
  },
  {
    document_id: 2,
    filename: 'biology.pdf',
    pages: 64,
    ingested: true,
    subject: 'BIO-101',
    sections: [
      {
        page: 18,
        heading: 'Cell Structure & Chloroplasts',
        text: 'Chloroplasts are double-membrane organelles in plant cells containing stacked thylakoids (grana) surrounded by stroma, where photosynthetic reactions take place.',
      },
      {
        page: 42,
        heading: 'Photosynthesis Overview',
        text: 'Photosynthesis is the process by which green plants, algae, and cyanobacteria convert light energy into chemical energy stored in glucose, using water, carbon dioxide, and chlorophyll pigments.',
      },
      {
        page: 45,
        heading: 'Calvin Cycle',
        text: 'The Calvin Cycle occurs in the chloroplast stroma and uses ATP and NADPH from light-dependent reactions to fix atmospheric CO2 into organic sugars via the enzyme RuBisCO.',
      },
    ],
  },
  {
    document_id: 3,
    filename: 'Machine_Learning_Foundations.pdf',
    pages: 56,
    ingested: true,
    subject: 'CS-402',
    sections: [
      {
        page: 12,
        heading: 'Gradient Descent & Loss Landscapes',
        text: 'Gradient descent is an iterative optimization algorithm that calculates the gradient of the loss function with respect to model parameters and updates weights in the negative gradient direction. Stochastic Gradient Descent (SGD) and Adam dynamically scale step sizes to accelerate convergence across complex loss surfaces.',
      },
      {
        page: 24,
        heading: 'Deep Neural Networks & Backpropagation',
        text: 'Deep neural networks learn hierarchical representations through stacked layers of linear transformations and non-linear activation functions (ReLU, GELU). Backpropagation applies the multivariate chain rule of calculus in reverse from the output layer to efficiently propagate loss gradients to all hidden layers.',
      },
      {
        page: 38,
        heading: 'Overfitting, Regularization & Dropout',
        text: 'Overfitting occurs when a high-capacity model memorizes training noise instead of generalizable patterns. Regularization techniques including L2 weight decay, Dropout (randomly zeroing unit activations during training), data augmentation, and early stopping constrain hypothesis complexity.',
      },
      {
        page: 51,
        heading: 'Transformers & Self-Attention',
        text: 'The Transformer architecture replaces recurrent architectures with multi-head self-attention. Self-attention computes attention weights via scaled dot-product between Query and Key matrices, routing information from Value vectors to capture long-range contextual dependencies across tokens.',
      },
    ],
  },
  {
    document_id: 4,
    filename: 'Database_Internals_and_Storage.pdf',
    pages: 68,
    ingested: true,
    subject: 'CS-510',
    sections: [
      {
        page: 15,
        heading: 'B+ Trees & Disk Page Layouts',
        text: 'B+ Trees are self-balancing search trees optimized for block storage. All keys and records reside in ordered leaf nodes linked by sibling pointers for high-throughput range scans, while internal nodes maintain high fan-out ratios to minimize disk I/O seek operations.',
      },
      {
        page: 29,
        heading: 'Write-Ahead Logging (WAL) & ARIES Recovery',
        text: 'Write-Ahead Logging (WAL) ensures durability and atomicity by requiring that log records describing state transitions be flushed to non-volatile disk before dirty database pages are written to tables. The ARIES recovery algorithm utilizes Analysis, Redo, and Undo phases.',
      },
      {
        page: 44,
        heading: 'Concurrency Control & Strict Two-Phase Locking',
        text: 'Concurrency control guarantees serializability and data integrity. Strict Two-Phase Locking (SS2PL) acquires shared locks for reads and exclusive locks for writes, holding all locks until transaction commit or abort to prevent cascading rollbacks.',
      },
      {
        page: 60,
        heading: 'Log-Structured Merge (LSM) Trees & Compaction',
        text: 'Log-Structured Merge (LSM) Trees optimize write-heavy database workloads. Incoming writes are appended to an in-memory MemTable and flushed sequentially to immutable Sorted String Tables (SSTables) on disk, with background compaction merging SSTables.',
      },
    ],
  },
  {
    document_id: 5,
    filename: 'Computer_Networks_and_Protocols.pdf',
    pages: 52,
    ingested: true,
    subject: 'CS-305',
    sections: [
      {
        page: 16,
        heading: 'TCP 3-Way Handshake & Reliable Delivery',
        text: 'The Transmission Control Protocol (TCP) establishes reliable stream communication using a 3-Way Handshake (SYN, SYN-ACK, ACK). Sequence and acknowledgment numbers track packet ordering, while sliding window flow control prevents fast senders from overwhelming slow receivers.',
      },
      {
        page: 28,
        heading: 'TCP Congestion Control & BBR',
        text: 'TCP Congestion Control prevents network collapse through algorithms like Slow Start, Congestion Avoidance, Fast Retransmit, and Fast Recovery. Modern congestion control protocols like TCP BBR (Bottleneck Bandwidth and RTT) measure physical bandwidth directly.',
      },
      {
        page: 40,
        heading: 'DNS Resolution & Hierarchical Caching',
        text: 'The Domain Name System (DNS) is a distributed hierarchical naming database. Resolvers query Root DNS servers, Top-Level Domain (TLD) servers, and Authoritative Name Servers to translate human-readable domain names into IP addresses, utilizing Time-To-Live (TTL) caching.',
      },
      {
        page: 49,
        heading: 'Transport Layer Security (TLS 1.3)',
        text: 'Transport Layer Security (TLS 1.3) encrypts Internet traffic and authenticates endpoints. It reduces the cryptographic handshake to a single round-trip (1-RTT) using Elliptic-Curve Diffie-Hellman Key Exchange (ECDHE) to deliver forward secrecy.',
      },
    ],
  },
]

export const QUIZ_BANK = {
  1: {
    mcq: [
      {
        question: 'Which property distinguishes a Mutex from a counting Semaphore?',
        options: {
          A: 'A mutex allows unlimited concurrent readers',
          B: 'A mutex enforces lock ownership by the acquiring thread',
          C: 'A mutex cannot be used across multiple CPU cores',
          D: 'A mutex disables hardware interrupts globally',
        },
        correct_answer: 'B',
        explanation: 'A mutex has strict ownership semantics: only the thread that locked it may unlock it.',
      },
      {
        question: 'Which hardware structure accelerates virtual-to-physical address translation?',
        options: {
          A: 'Arithmetic Logic Unit (ALU)',
          B: 'Direct Memory Access (DMA)',
          C: 'Translation Lookaside Buffer (TLB)',
          D: 'Interrupt Vector Table (IVT)',
        },
        correct_answer: 'C',
        explanation: 'The TLB caches recent page table entries so virtual addresses translate in a single cycle.',
      },
      {
        question: 'Which of the following is NOT one of the four Coffman deadlock conditions?',
        options: {
          A: 'Mutual exclusion',
          B: 'Circular wait',
          C: 'Hold and wait',
          D: 'Priority inversion',
        },
        correct_answer: 'D',
        explanation: 'The four Coffman conditions are mutual exclusion, hold and wait, no preemption, and circular wait.',
      },
      {
        question: 'What happens when a process accesses a virtual page not currently resident in RAM?',
        options: {
          A: 'A page fault trap invokes the OS to fetch the page from disk',
          B: 'The CPU immediately terminates the process',
          C: 'The TLB automatically allocates an empty zero frame without OS involvement',
          D: 'The scheduler switches to FIFO mode permanently',
        },
        correct_answer: 'A',
        explanation: 'Demand paging handles missing pages via a page fault interrupt that loads the page into physical memory.',
      },
      {
        question: 'What is stored inside a Process Control Block (PCB)?',
        options: {
          A: 'Only the compiled binary file on disk',
          B: 'Process state, program counter, CPU registers, and scheduling metadata',
          C: 'Network DNS cache records',
          D: 'GPU shader pipelines exclusively',
        },
        correct_answer: 'B',
        explanation: 'The PCB tracks everything the OS needs to suspend and resume a process during context switching.',
      },
    ],
    true_false: [
      {
        question: 'Breaking the Circular Wait condition is sufficient to prevent deadlock.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'A',
        explanation: 'All four Coffman conditions must hold simultaneously for deadlock; eliminating any one prevents it.',
      },
      {
        question: 'Virtual memory requires the entire program to fit in physical RAM before execution starts.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'B',
        explanation: 'Demand paging loads only the actively needed pages into RAM on demand.',
      },
      {
        question: 'Round Robin scheduling uses a fixed time quantum to preempt running processes.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'A',
        explanation: 'Round Robin cycles through ready processes giving each a bounded time slice for fairness.',
      },
      {
        question: 'A race condition occurs when output depends on the unpredictable interleaving of concurrent threads.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'A',
        explanation: 'Unsynchronized shared state updates across threads cause non-deterministic race conditions.',
      },
    ],
    flashcard: [
      {
        question: 'Mutex (Mutual Exclusion Lock)',
        correct_answer: 'Synchronization primitive granting exclusive critical-section access to a single owning thread.',
        explanation: 'Prevents race conditions when modifying shared state in Operating_Systems.pdf (p. 28).',
      },
      {
        question: 'Translation Lookaside Buffer (TLB)',
        correct_answer: 'High-speed hardware associative cache storing recent virtual-to-physical page translations.',
        explanation: 'Avoids extra memory lookups in multi-level page tables (p. 42).',
      },
      {
        question: 'Four Coffman Deadlock Conditions',
        correct_answer: 'Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.',
        explanation: 'All four must hold simultaneously for a system deadlock to occur (p. 35).',
      },
      {
        question: 'Demand Paging',
        correct_answer: 'Memory management technique where pages are loaded from secondary storage only upon a page fault.',
        explanation: 'Reduces startup latency and physical memory footprint (p. 42).',
      },
    ],
  },
  2: {
    mcq: [
      {
        question: 'What is photosynthesis?',
        options: {
          A: 'Process of respiration',
          B: 'Process of producing food using light',
          C: 'Process of digestion',
          D: 'Process of reproduction',
        },
        correct_answer: 'B',
        explanation: 'Plants use light energy, water, and CO2 to produce glucose and oxygen.',
      },
      {
        question: 'Where does the Calvin Cycle take place inside a chloroplast?',
        options: {
          A: 'Outer membrane',
          B: 'Stroma',
          C: 'Mitochondrial matrix',
          D: 'Nucleolus',
        },
        correct_answer: 'B',
        explanation: 'The Calvin Cycle uses ATP and NADPH in the chloroplast stroma to fix carbon dioxide.',
      },
      {
        question: 'Which enzyme catalyzes carbon fixation in the Calvin Cycle?',
        options: {
          A: 'Amylase',
          B: 'DNA Polymerase',
          C: 'RuBisCO',
          D: 'Catalase',
        },
        correct_answer: 'C',
        explanation: 'RuBisCO fixes atmospheric CO2 into organic carbon compounds during photosynthesis.',
      },
    ],
    true_false: [
      {
        question: 'Light-dependent reactions occur across the thylakoid membranes inside chloroplasts.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'A',
        explanation: 'Chlorophyll embedded in thylakoid membranes captures photons to synthesize ATP and NADPH.',
      },
      {
        question: 'Photosynthesis converts chemical energy into light energy.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'B',
        explanation: 'Photosynthesis converts light energy into chemical energy stored in glucose.',
      },
    ],
    flashcard: [
      {
        question: 'Photosynthesis',
        correct_answer: 'Conversion of solar light energy, CO2, and H2O into glucose and O2.',
        explanation: 'Primary energy pathway in plants and algae (biology.pdf, p. 42).',
      },
      {
        question: 'Chlorophyll',
        correct_answer: 'Green pigment in thylakoids that absorbs light energy for photosynthesis.',
        explanation: 'Reflects green light while absorbing red and blue wavelengths (p. 42).',
      },
      {
        question: 'Calvin Cycle',
        correct_answer: 'Light-independent carbon fixation stage in the stroma producing organic sugars.',
        explanation: 'Powered by ATP and NADPH via RuBisCO (p. 45).',
      },
    ],
  },
  3: {
    mcq: [
      {
        question: 'What mathematical principle powers the backward pass in training deep neural networks?',
        options: {
          A: 'L’Hôpital’s Rule',
          B: 'Multivariate Chain Rule of Calculus',
          C: 'Bayes Theorem of Conditional Probability',
          D: 'Taylor Series Polynomial Expansion',
        },
        correct_answer: 'B',
        explanation: 'Backpropagation propagates error gradients backward from the loss function using the multivariate chain rule.',
      },
      {
        question: 'Which mechanism prevents overfitting by randomly zeroing unit activations during training?',
        options: {
          A: 'Batch Normalization',
          B: 'Dropout',
          C: 'Gradient Clipping',
          D: 'Data Quantization',
        },
        correct_answer: 'B',
        explanation: 'Dropout forces the network to learn redundant representations by deactivating random units with probability p.',
      },
      {
        question: 'In the Transformer architecture, what three matrix projections compute self-attention?',
        options: {
          A: 'Weights, Biases, Gradients',
          B: 'Queries, Keys, Values',
          C: 'Inputs, Targets, Errors',
          D: 'Priors, Likelihoods, Posteriors',
        },
        correct_answer: 'B',
        explanation: 'Scaled dot-product attention computes softmax(Q * K^T / sqrt(d_k)) * V using Query, Key, and Value matrices.',
      },
    ],
    true_false: [
      {
        question: 'Stochastic Gradient Descent computes loss gradients over the entire training set in each step.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'B',
        explanation: 'Standard Batch Gradient Descent uses the entire dataset; SGD updates weights using a single sample or mini-batch.',
      },
      {
        question: 'L2 regularization penalizes the squared magnitude of weights to discourage extreme parameter values.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'A',
        explanation: 'L2 regularization (weight decay) adds lambda * ||w||^2 to the loss function.',
      },
    ],
    flashcard: [
      {
        question: 'Gradient Descent',
        correct_answer: 'Optimization algorithm that minimizes loss by stepping in the negative gradient direction.',
        explanation: 'Core learning engine for modern neural networks (Machine_Learning_Foundations.pdf, p. 12).',
      },
      {
        question: 'Self-Attention',
        correct_answer: 'Attention mechanism routing token representations based on pairwise similarity across sequences.',
        explanation: 'Replaces recurrence in Transformer models (p. 51).',
      },
      {
        question: 'Regularization',
        correct_answer: 'Techniques (L1, L2, Dropout) used to prevent models from overfitting training noise.',
        explanation: 'Balances the bias-variance tradeoff (p. 38).',
      },
    ],
  },
  4: {
    mcq: [
      {
        question: 'Why are all database leaf nodes linked by sibling pointers in a B+ Tree?',
        options: {
          A: 'To allow circular memory hashing',
          B: 'To execute sequential range scans without traversing parent nodes',
          C: 'To prevent index key fragmentation completely',
          D: 'To disable table locks during concurrent writes',
        },
        correct_answer: 'B',
        explanation: 'Sibling pointers allow fast linear range scans across leaf pages once the start key is located.',
      },
      {
        question: 'What core requirement does Write-Ahead Logging (WAL) enforce before modifying table pages on disk?',
        options: {
          A: 'All indexes must be reconstructed from scratch',
          B: 'Log records must be written and flushed to disk before dirty database pages are written',
          C: 'Transactions must wait for full table garbage collection',
          D: 'The database must switch to read-only replica mode',
        },
        correct_answer: 'B',
        explanation: 'The WAL protocol ensures durability and crash-recoverability by guaranteeing logs precede disk page writes.',
      },
    ],
    true_false: [
      {
        question: 'In Strict Two-Phase Locking (SS2PL), exclusive locks are held until transaction commit.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'A',
        explanation: 'Holding locks until transaction termination guarantees strict serializability and avoids cascading rollbacks.',
      },
    ],
    flashcard: [
      {
        question: 'Write-Ahead Log (WAL)',
        correct_answer: 'Append-only disk log guaranteeing durability and atomic rollback recovery (ARIES).',
        explanation: 'Must be flushed prior to table page writes (Database_Internals.pdf, p. 29).',
      },
      {
        question: 'B+ Tree',
        correct_answer: 'Self-balancing high fan-out tree where all data resides in linked leaf nodes for fast range scans.',
        explanation: 'Standard index structure in relational databases (p. 15).',
      },
    ],
  },
  5: {
    mcq: [
      {
        question: 'What three packet flags establish a reliable connection during the TCP Handshake?',
        options: {
          A: 'FIN, FIN-ACK, ACK',
          B: 'SYN, SYN-ACK, ACK',
          C: 'RST, PSH, URG',
          D: 'HELLO, OFFER, ACK',
        },
        correct_answer: 'B',
        explanation: 'TCP uses SYN -> SYN-ACK -> ACK to synchronize sequence numbers and establish bidirectional streams.',
      },
      {
        question: 'How does TLS 1.3 achieve 1-RTT handshake latency compared to older TLS versions?',
        options: {
          A: 'It sends symmetric keys completely unencrypted in plaintext',
          B: 'The client sends its Diffie-Hellman key share in the very first ClientHello message',
          C: 'It eliminates digital certificates entirely',
          D: 'It requires pre-shared master keys hardcoded on every device',
        },
        correct_answer: 'B',
        explanation: 'TLS 1.3 speculatively includes Key Share parameters in the ClientHello, completing encryption negotiation in 1 RTT.',
      },
    ],
    true_false: [
      {
        question: 'TCP Congestion Control relies solely on physical receiver buffer size.',
        options: { A: 'True', B: 'False' },
        correct_answer: 'B',
        explanation: 'Flow control manages receiver buffer size; Congestion Control manages network path capacity (cwnd).',
      },
    ],
    flashcard: [
      {
        question: 'TCP 3-Way Handshake',
        correct_answer: 'SYN -> SYN-ACK -> ACK sequence synchronizing stream numbers and establishing reliable sockets.',
        explanation: 'Fundamental connection mechanism of TCP (Computer_Networks.pdf, p. 16).',
      },
      {
        question: 'DNS Caching',
        correct_answer: 'Temporary local storage of resolved domain-to-IP records bounded by Time-To-Live (TTL).',
        explanation: 'Prevents overwhelming authoritative root name servers (p. 40).',
      },
    ],
  },
}

export const BRAIN_MAPS = {
  1: {
    success: true,
    map_id: 301,
    nodes: [
      { id: 'os_kernel', label: 'OS Kernel', type: 'core', summary: 'Central supervisor managing CPU, memory, and I/O.' },
      { id: 'concurrency', label: 'Concurrency', type: 'concept', summary: 'Simultaneous execution of threads and processes.' },
      { id: 'mutex', label: 'Mutex Lock', type: 'mechanism', summary: 'Binary lock with single-thread ownership.' },
      { id: 'semaphore', label: 'Semaphore', type: 'mechanism', summary: 'Signaling counter controlling resource pools.' },
      { id: 'deadlock', label: 'Deadlock', type: 'risk', summary: 'Circular waiting where no thread can proceed.' },
      { id: 'virtual_mem', label: 'Virtual Memory', type: 'concept', summary: 'Abstracted per-process memory address space.' },
      { id: 'page_table', label: 'Page Table', type: 'mechanism', summary: 'Maps virtual pages to physical RAM frames.' },
      { id: 'tlb', label: 'TLB Cache', type: 'hardware', summary: 'Fast hardware cache for address translations.' },
      { id: 'scheduler', label: 'CPU Scheduler', type: 'mechanism', summary: 'Selects ready processes using time quanta.' },
    ],
    edges: [
      { source: 'os_kernel', target: 'concurrency', relationship: 'coordinates' },
      { source: 'os_kernel', target: 'virtual_mem', relationship: 'manages' },
      { source: 'os_kernel', target: 'scheduler', relationship: 'dispatches' },
      { source: 'concurrency', target: 'mutex', relationship: 'synchronized_by' },
      { source: 'concurrency', target: 'semaphore', relationship: 'regulated_by' },
      { source: 'mutex', target: 'deadlock', relationship: 'can_trigger' },
      { source: 'virtual_mem', target: 'page_table', relationship: 'mapped_via' },
      { source: 'page_table', target: 'tlb', relationship: 'accelerated_by' },
      { source: 'scheduler', target: 'concurrency', relationship: 'enables' },
    ],
  },
  2: {
    success: true,
    map_id: 302,
    nodes: [
      { id: 'photosynthesis', label: 'Photosynthesis', type: 'core', summary: 'Converts light energy into chemical glucose.' },
      { id: 'chlorophyll', label: 'Chlorophyll', type: 'mechanism', summary: 'Light-absorbing green pigment in thylakoids.' },
      { id: 'chloroplast', label: 'Chloroplast', type: 'hardware', summary: 'Plant organelle housing photosynthetic stages.' },
      { id: 'light_reactions', label: 'Light Reactions', type: 'concept', summary: 'Generate ATP and NADPH using sunlight.' },
      { id: 'calvin_cycle', label: 'Calvin Cycle', type: 'concept', summary: 'Fixes CO2 into sugars in the stroma.' },
      { id: 'rubisco', label: 'RuBisCO', type: 'mechanism', summary: 'Key carbon-fixation enzyme.' },
      { id: 'glucose', label: 'Glucose', type: 'core', summary: 'Stored chemical energy product.' },
    ],
    edges: [
      { source: 'photosynthesis', target: 'chlorophyll', relationship: 'uses' },
      { source: 'photosynthesis', target: 'chloroplast', relationship: 'occurs_in' },
      { source: 'chlorophyll', target: 'light_reactions', relationship: 'powers' },
      { source: 'light_reactions', target: 'calvin_cycle', relationship: 'supplies_ATP' },
      { source: 'calvin_cycle', target: 'rubisco', relationship: 'catalyzed_by' },
      { source: 'calvin_cycle', target: 'glucose', relationship: 'synthesizes' },
    ],
  },
  3: {
    success: true,
    map_id: 303,
    nodes: [
      { id: 'deep_learning', label: 'Deep Learning', type: 'core', summary: 'Hierarchical representation learning with neural nets.' },
      { id: 'gradient_descent', label: 'Gradient Descent', type: 'mechanism', summary: 'Iterative loss optimization along negative gradient.' },
      { id: 'backprop', label: 'Backpropagation', type: 'mechanism', summary: 'Calculates gradients backward via chain rule.' },
      { id: 'loss_function', label: 'Loss Function', type: 'concept', summary: 'Quantifies objective error between prediction and target.' },
      { id: 'dropout', label: 'Dropout', type: 'mechanism', summary: 'Deactivates random units during training to prevent overfitting.' },
      { id: 'transformers', label: 'Transformers', type: 'concept', summary: 'Self-attention architecture modeling token relationships.' },
      { id: 'self_attention', label: 'Self-Attention', type: 'mechanism', summary: 'Scaled dot-product attention across Query, Key, Value.' },
      { id: 'regularization', label: 'Regularization', type: 'concept', summary: 'Constrains model complexity to ensure generalization.' },
    ],
    edges: [
      { source: 'deep_learning', target: 'gradient_descent', relationship: 'optimized_by' },
      { source: 'deep_learning', target: 'transformers', relationship: 'includes' },
      { source: 'gradient_descent', target: 'loss_function', relationship: 'minimizes' },
      { source: 'gradient_descent', target: 'backprop', relationship: 'guided_by' },
      { source: 'deep_learning', target: 'regularization', relationship: 'stabilized_by' },
      { source: 'regularization', target: 'dropout', relationship: 'implemented_by' },
      { source: 'transformers', target: 'self_attention', relationship: 'powered_by' },
    ],
  },
  4: {
    success: true,
    map_id: 304,
    nodes: [
      { id: 'db_engine', label: 'Storage Engine', type: 'core', summary: 'Manages disk pages, index structures, and transactions.' },
      { id: 'b_plus_tree', label: 'B+ Tree Index', type: 'mechanism', summary: 'High fan-out balanced tree with linked leaf nodes.' },
      { id: 'wal', label: 'Write-Ahead Log', type: 'mechanism', summary: 'Appends redo/undo entries before updating table pages.' },
      { id: 'aries', label: 'ARIES Recovery', type: 'concept', summary: 'Three-pass crash recovery ensuring ACID durability.' },
      { id: 'two_pl', label: 'Strict 2PL', type: 'concept', summary: 'Two-phase locking preventing race conditions.' },
      { id: 'lsm_tree', label: 'LSM Tree', type: 'hardware', summary: 'Sequential write-optimized storage with SSTables.' },
    ],
    edges: [
      { source: 'db_engine', target: 'b_plus_tree', relationship: 'indexes_with' },
      { source: 'db_engine', target: 'wal', relationship: 'logs_with' },
      { source: 'wal', target: 'aries', relationship: 'enables' },
      { source: 'db_engine', target: 'two_pl', relationship: 'synchronizes_via' },
      { source: 'db_engine', target: 'lsm_tree', relationship: 'persists_via' },
    ],
  },
  5: {
    success: true,
    map_id: 305,
    nodes: [
      { id: 'transport_layer', label: 'Transport Layer', type: 'core', summary: 'Host-to-host end-to-end communication multiplexing.' },
      { id: 'tcp', label: 'TCP Protocol', type: 'concept', summary: 'Connection-oriented reliable stream transport.' },
      { id: 'handshake', label: '3-Way Handshake', type: 'mechanism', summary: 'SYN, SYN-ACK, ACK connection establishment.' },
      { id: 'congestion_control', label: 'Congestion Control', type: 'concept', summary: 'Adjusts cwnd window to prevent network bufferbloat.' },
      { id: 'bbr', label: 'BBR Algorithm', type: 'mechanism', summary: 'Measures bandwidth and RTT to maximize throughput.' },
      { id: 'dns', label: 'DNS System', type: 'hardware', summary: 'Hierarchical distributed domain-to-IP directory.' },
      { id: 'tls_13', label: 'TLS 1.3', type: 'mechanism', summary: '1-RTT cryptographic forward secrecy session.' },
    ],
    edges: [
      { source: 'transport_layer', target: 'tcp', relationship: 'provides' },
      { source: 'tcp', target: 'handshake', relationship: 'initiates_via' },
      { source: 'tcp', target: 'congestion_control', relationship: 'governed_by' },
      { source: 'congestion_control', target: 'bbr', relationship: 'implemented_with' },
      { source: 'transport_layer', target: 'tls_13', relationship: 'secured_by' },
      { source: 'tcp', target: 'dns', relationship: 'queries_over' },
    ],
  },
}

export const SAMPLE_DATASET_CSV = `temperature,humidity,light_hours,growth,yield_score
18,62,6,14.2,54
20,60,7,18.6,61
22,58,8,24.1,69
24,55,9,31.4,77
26,53,10,38.9,84
28,50,11,44.2,90
30,48,12,47.8,93
32,46,12,45.1,88
34,44,11,39.5,81
36,42,10,33.0,72`
