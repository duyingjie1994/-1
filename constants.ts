import { GraphData, LayerType } from "./types";

export const INITIAL_DATA: GraphData = {
  nodes: [
    // Layer 0: 培养目标 (Objectives) - Expanded to 3 items
    { id: "obj1", label: "工程技术能力", layer: 0, type: LayerType.OBJECTIVE, description: "能够综合运用数学、自然科学和工程科学的基本原理，设计复杂计算系统解决方案。" },
    { id: "obj2", label: "创新思维", layer: 0, type: LayerType.OBJECTIVE, description: "具备自主学习能力，紧跟技术前沿，具备创新思维和国际化视野。" },
    { id: "obj3", label: "职业素养", layer: 0, type: LayerType.OBJECTIVE, description: "具备良好的职业道德、社会责任感和团队协作能力。" },

    // Layer 1: 毕业要求 (Requirements)
    { id: "req1", label: "R1.工程知识", layer: 1, type: LayerType.REQUIREMENT, description: "掌握数学、自然科学、工程基础和专业知识。" },
    { id: "req2", label: "R2.问题分析", layer: 1, type: LayerType.REQUIREMENT, description: "能够应用基本原理识别、表达、分析复杂工程问题。" },
    { id: "req3", label: "R3.设计/开发", layer: 1, type: LayerType.REQUIREMENT, description: "能够设计针对复杂工程问题的解决方案。" },
    { id: "req4", label: "R4.团队协作", layer: 1, type: LayerType.REQUIREMENT, description: "能够在多学科背景下的团队中承担个体、团队成员或负责人的角色。" },
    { id: "req5", label: "R5.沟通能力", layer: 1, type: LayerType.REQUIREMENT, description: "能够就复杂工程问题与业界同行及社会公众进行有效沟通。" },

    // Layer 2: 课程体系 (Courses)
    { id: "c1", label: "高级语言程序设计", layer: 2, type: LayerType.COURSE },
    { id: "c2", label: "数据结构", layer: 2, type: LayerType.COURSE },
    { id: "c3", label: "操作系统", layer: 2, type: LayerType.COURSE },
    { id: "c4", label: "数据库原理", layer: 2, type: LayerType.COURSE },
    { id: "c5", label: "软件工程", layer: 2, type: LayerType.COURSE },
    { id: "c6", label: "计算机网络", layer: 2, type: LayerType.COURSE },
    { id: "c7", label: "职业规划", layer: 2, type: LayerType.COURSE },
    { id: "c8", label: "算法设计", layer: 2, type: LayerType.COURSE },

    // Layer 3: 知识点 (Knowledge Points)
    { id: "k1", label: "指针与内存", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k2", label: "递归算法", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k3", label: "B+树索引", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k4", label: "进程调度", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k5", label: "死锁处理", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k6", label: "事务ACID", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k7", label: "需求分析", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k8", label: "TCP/IP协议", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k9", label: "设计模式", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k10", label: "Socket编程", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k11", label: "敏捷开发", layer: 3, type: LayerType.KNOWLEDGE },
    { id: "k12", label: "沟通技巧", layer: 3, type: LayerType.KNOWLEDGE },
  ],
  links: [
    // L1 -> L0
    { source: "req1", target: "obj1" },
    { source: "req2", target: "obj1" },
    { source: "req3", target: "obj1" },
    { source: "req2", target: "obj2" }, 
    { source: "req3", target: "obj2" }, 
    { source: "req4", target: "obj3" },
    { source: "req5", target: "obj3" },
    { source: "req5", target: "obj2" }, // Cross

    // L2 -> L1
    { source: "c1", target: "req1" },
    { source: "c1", target: "req3" },
    { source: "c2", target: "req1" },
    { source: "c2", target: "req2" }, 
    { source: "c3", target: "req1" },
    { source: "c3", target: "req2" },
    { source: "c4", target: "req1" },
    { source: "c4", target: "req3" }, 
    { source: "c5", target: "req3" },
    { source: "c5", target: "req4" },
    { source: "c6", target: "req1" },
    { source: "c7", target: "req5" },
    { source: "c7", target: "req4" },
    { source: "c8", target: "req2" },
    { source: "c8", target: "req3" },

    // L3 -> L2
    { source: "k1", target: "c1" },
    { source: "k1", target: "c3" }, 
    { source: "k2", target: "c1" },
    { source: "k2", target: "c2" },
    { source: "k2", target: "c8" },
    { source: "k3", target: "c4" },
    { source: "k4", target: "c3" },
    { source: "k5", target: "c3" },
    { source: "k5", target: "c4" }, 
    { source: "k6", target: "c4" },
    { source: "k7", target: "c5" },
    { source: "k8", target: "c6" },
    { source: "k9", target: "c5" },
    { source: "k10", target: "c6" },
    { source: "k10", target: "c1" },
    { source: "k11", target: "c5" },
    { source: "k12", target: "c7" },
  ]
};
