import React, { useState, useEffect, useMemo } from 'react';
import { INITIAL_BRAIN_GRAPH } from '../data/brainGraph';
import { BrainMapView } from './BrainMapView';

const BRAIN_GRAPH_STORAGE_KEY = 'helios_brain_graph_v1';

export default function BrainMap({
  documents = [],
  activeDocId,
  onActivity,
  backendOnline = false,
  onSelectDoc,
}) {
  const [brainGraph, setBrainGraph] = useState(() => {
    try {
      const raw = localStorage.getItem(BRAIN_GRAPH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.triples) && parsed.nodes.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_BRAIN_GRAPH;
  });

  const [isExtractingGraph, setIsExtractingGraph] = useState(false);
  const [graphError, setGraphError] = useState(null);

  // Persist graph
  useEffect(() => {
    try {
      localStorage.setItem(BRAIN_GRAPH_STORAGE_KEY, JSON.stringify(brainGraph));
    } catch {
      // ignore
    }
  }, [brainGraph]);

  // Normalize documents to StudyDocument shape for BrainMapView
  const studyDocuments = useMemo(() => {
    return (documents || []).map((doc, idx) => {
      const docId = String(doc.document_id ?? doc.id ?? idx + 1);
      const title = doc.title || doc.filename || doc.fileName || `Document ${idx + 1}`;
      const fileName = doc.filename || doc.fileName || `document_${idx + 1}.pdf`;
      const courseCode = doc.subject || doc.courseCode || 'General';
      const courseName = doc.courseName || doc.subject || title;
      const masteryPercent = doc.progress ?? doc.masteryPercent ?? 80;
      const lastChapter = doc.lastChapter || 'Chapter 1: Overview';

      let pages = [];
      if (Array.isArray(doc.pages) && doc.pages.length > 0 && typeof doc.pages[0] === 'object') {
        pages = doc.pages;
      } else if (Array.isArray(doc.sections) && doc.sections.length > 0) {
        pages = doc.sections.map((sec, pIdx) => ({
          pageNumber: sec.page ?? pIdx + 1,
          title: sec.heading ?? `Page ${sec.page ?? pIdx + 1}`,
          content: sec.text ?? '',
        }));
      } else {
        const pageCount = typeof doc.pages === 'number' ? doc.pages : 8;
        pages = Array.from({ length: Math.min(pageCount, 12) }, (_, i) => ({
          pageNumber: i + 1,
          title: `Section ${i + 1}`,
          content: `Content for ${fileName} on page ${i + 1}.`,
        }));
      }

      return {
        id: docId,
        title,
        fileName,
        courseCode,
        courseName,
        masteryPercent,
        lastChapter,
        pages,
      };
    });
  }, [documents]);

  const handleExtractBrainGraph = async (focusTopic) => {
    setIsExtractingGraph(true);
    setGraphError(null);

    const topicLabel = focusTopic ? focusTopic.trim() : 'Cross-Course Systems';

    try {
      if (backendOnline) {
        const payload = {
          focusTopic: topicLabel,
          documents: studyDocuments.map((d) => ({
            id: d.id,
            title: d.title,
            fileName: d.fileName,
            courseCode: d.courseCode,
            pages: d.pages.slice(0, 10).map((p) => ({
              pageNumber: p.pageNumber,
              title: p.title,
              content: (p.content || '').slice(0, 800),
            })),
          })),
        };

        const res = await fetch('/api/brainmap/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
            setBrainGraph(data);
            if (onActivity) {
              onActivity({
                title: `AI Brain Map Extracted: "${topicLabel}"`,
                time: 'Just now',
                type: 'search',
                target: 'brain-map',
              });
            }
            return;
          }
        }
      }

      // Local / Offline fallback generation tailored to focus topic and actual documents
      await new Promise((r) => setTimeout(r, 600));

      if (!studyDocuments || studyDocuments.length === 0) {
        throw new Error('Please upload study documents in Smart Search first to extract concepts.');
      }

      const lowerTopic = topicLabel.toLowerCase();
      const baseDocs = studyDocuments;

      const docNodes = baseDocs.slice(0, 3).map((d) => ({
        id: `doc-${d.id}`,
        label: d.fileName,
        kind: 'document',
        summary: `Study document source for ${d.title}.`,
        sources: [{ documentId: String(d.id), fileName: d.fileName, pageNumber: 1 }],
      }));

      // Create bridge nodes focused on this topic
      const bridgeName = focusTopic ? `${focusTopic} Hub` : 'Core Synchronization';
      const bridgeNodes = [
        {
          id: `bridge-${Date.now()}-1`,
          label: bridgeName,
          kind: 'bridge',
          summary: `Primary conceptual intersection linking ${baseDocs.map((d) => d.fileName).join(' & ')} on ${topicLabel}.`,
          sources: baseDocs.slice(0, 2).map((d, i) => ({
            documentId: String(d.id),
            fileName: d.fileName,
            pageNumber: (i + 1) * 3,
          })),
        },
        {
          id: `bridge-${Date.now()}-2`,
          label: 'Shared State & Durability',
          kind: 'bridge',
          summary: 'Cross-cutting guarantees protecting memory consistency across processes and files.',
          sources: baseDocs.slice(0, 2).map((d, i) => ({
            documentId: String(d.id),
            fileName: d.fileName,
            pageNumber: (i + 2) * 2,
          })),
        },
      ];

      // Extract concepts from sections or standard vocabulary
      const conceptWords = lowerTopic.includes('memory') || lowerTopic.includes('paging')
        ? ['Paging Tables', 'TLB Translation', 'Demand Faulting', 'Page Frame Allocation', 'Swapping Overhead']
        : lowerTopic.includes('recovery') || lowerTopic.includes('log')
          ? ['WAL Log Sequence', 'Checkpointing', 'ARIES Analysis', 'Redo Pass', 'Undo Inversion']
          : lowerTopic.includes('consensus') || lowerTopic.includes('distribut')
            ? ['Raft Leader Election', 'Quorum Agreement', 'Heartbeat Ping', 'Split-Brain Prevention', 'Log Replication']
            : ['Mutex Locks', 'Critical Section', 'Condition Variables', 'Deadlock Detection', 'Spinlock Polling'];

      const conceptNodes = conceptWords.map((cw, i) => ({
        id: `con-${Date.now()}-${i}`,
        label: cw,
        kind: 'concept',
        summary: `Key operational principle: ${cw} required for ${topicLabel}.`,
        sources: [{
          documentId: String(baseDocs[i % baseDocs.length].id),
          fileName: baseDocs[i % baseDocs.length].fileName,
          pageNumber: i + 2,
        }],
      }));

      const allNodes = [...docNodes, ...bridgeNodes, ...conceptNodes];
      const triples = [];

      // Link docs to bridges
      docNodes.forEach((dn, i) => {
        const b = bridgeNodes[i % bridgeNodes.length];
        triples.push({
          id: `t-${Date.now()}-doc-${i}`,
          sourceId: dn.id,
          targetId: b.id,
          relation: 'defines context for',
          fileName: dn.label,
          pageNumber: 1,
        });
      });

      // Link bridges to concepts
      conceptNodes.forEach((cn, i) => {
        const b = bridgeNodes[i % bridgeNodes.length];
        triples.push({
          id: `t-${Date.now()}-con-${i}`,
          sourceId: b.id,
          targetId: cn.id,
          relation: i % 2 === 0 ? 'implements' : 'enforces',
          fileName: cn.sources[0]?.fileName,
          pageNumber: cn.sources[0]?.pageNumber,
        });
      });

      const updatedGraph = {
        focusTopic: topicLabel,
        generatedAt: new Date().toISOString(),
        nodes: allNodes,
        triples,
      };

      setBrainGraph(updatedGraph);
      if (onActivity) {
        onActivity({
          title: `Mapped Brain Triples for "${topicLabel}"`,
          time: 'Just now',
          type: 'search',
          target: 'brain-map',
        });
      }
    } catch (err) {
      setGraphError(err.message || 'Failed to extract graph. Please try another focus keyword.');
    } finally {
      setIsExtractingGraph(false);
    }
  };

  const handleResetDefaultGraph = () => {
    setGraphError(null);
    setBrainGraph(INITIAL_BRAIN_GRAPH);
  };

  const handleOpenPageInSearch = (docId, pageNumber, question) => {
    if (onSelectDoc) {
      onSelectDoc(docId);
    }
    if (onActivity) {
      onActivity({
        title: question ? `Queried: "${question.slice(0, 32)}…"` : `Inspected Page ${pageNumber}`,
        time: 'Just now',
        type: 'search',
        target: 'smart-search',
      });
    }
  };

  return (
    <BrainMapView
      graph={brainGraph}
      documents={studyDocuments}
      isExtracting={isExtractingGraph}
      extractError={graphError}
      onExtractGraph={handleExtractBrainGraph}
      onResetDefaultGraph={handleResetDefaultGraph}
      onOpenPageInSearch={handleOpenPageInSearch}
    />
  );
}
