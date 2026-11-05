"""Hand-built nodes for converter tests. No WZ bytes."""
from __future__ import annotations


class Node:
    def __init__(self, name, *, value=None, uol=False):
        self.name = name
        self.parent = None
        self.value = value
        self.synthetic_uol = uol
        self._children = {}

    def add(self, child):
        child.parent = self
        self._children[child.name] = child
        return child

    def child(self, name):
        return self._children.get(name)

    def children(self):
        return list(self._children.values())

    def get(self, path: str):
        node = self
        for part in str(path).split("/"):
            if part == "" or part == ".":
                continue
            if part == "..":
                node = node.parent if node else None
                continue
            if node is None:
                return None
            node = node.child(part)
        return node


def link(parent, name, value):
    return parent.add(Node(name, value=value, uol=True))


def chain(length, final_name="canvas"):
    """``length`` UOL nodes, each pointing at the next sibling, then one plain node."""
    root = Node("root")
    for index in range(length):
        link(root, str(index), str(index + 1))
    root.add(Node(final_name if length == 0 else str(length)))
    return root.child("0")
