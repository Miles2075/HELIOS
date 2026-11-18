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
  { code: 'CS-402', title: 'Machine Learning', progress: 45, chapter: 'Chapter 3: Gradient Descent' },
  { code: 'CS-510', title: 'Database Internals', progress: 90, chapter: 'Chapter 8: B+ Trees & WAL' },
  { code: 'DS-204', title: 'Statistical Analysis', progress: 68, chapter: 'Chapter 5: Hypothesis Testing' },
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
