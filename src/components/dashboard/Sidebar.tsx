import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { Icon } from "@stellar/design-system";
import { useWallet } from "../../hooks/useWallet";
import "./dashboard.css";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  path: string; // Base path for the group
  subItems: NavItem[];
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const navGroups: (NavItem | NavGroup)[] = [
  {
    path: "/dashboard",
    label: "Overview",
    icon: <Icon.Eye size="md" />,
  },
  {
    label: "Stream",
    icon: <Icon.Code02 size="md" />,
    path: "/dashboard/streams",
    subItems: [
      {
        path: "/dashboard/streams/create",
        label: "Create",
        icon: <Icon.PlusSquare size="sm" />,
      },
      {
        path: "/dashboard/streams",
        label: "My Streams",
        icon: <Icon.Code02 size="sm" />,
      },
    ],
  },
  {
    label: "Subscriptions",
    icon: <Icon.Code02 size="md" />,
    path: "/dashboard/subscriptions",
    subItems: [
      {
        path: "/dashboard/subscriptions/create",
        label: "Create",
        icon: <Icon.PlusSquare size="sm" />,
      },
      {
        path: "/dashboard/subscriptions",
        label: "My Subscriptions",
        icon: <Icon.Code02 size="sm" />,
      },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address } = useWallet();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Auto-expand groups if current path matches their subItems
  useEffect(() => {
    const newExpanded = new Set<string>();
    navGroups.forEach((group) => {
      if ('subItems' in group) {
        const hasActiveSubItem = group.subItems.some(
          (item) => location.pathname === item.path
        );
        if (hasActiveSubItem) {
          newExpanded.add(group.label);
        }
      }
    });
    setExpandedGroups(newExpanded);
  }, [location.pathname]);

  if (!address) {
    return null;
  }

  const toggleGroup = (groupLabel: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupLabel)) {
      newExpanded.delete(groupLabel);
    } else {
      newExpanded.add(groupLabel);
    }
    setExpandedGroups(newExpanded);
  };

  const isGroupExpanded = (groupLabel: string) => {
    return expandedGroups.has(groupLabel);
  };

  const isGroupActive = (group: NavGroup) => {
    return group.subItems.some((item) => location.pathname === item.path);
  };

  return (
    <aside className={`dashboard-sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <Link to="/" className="sidebar-logo" title="Go to home">
          <Icon.Code02 size="lg" />
          {!isCollapsed && <span>Streamr</span>}
        </Link>
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
          {isCollapsed ? <Icon.ChevronRight size="sm" /> : <Icon.ChevronLeft size="sm" />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((item) => {
          // Regular nav item (no subItems)
          if (!('subItems' in item)) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </NavLink>
            );
          }

          // Nav group with subItems
          const group = item as NavGroup;
          const isExpanded = isGroupExpanded(group.label);
          const isActive = isGroupActive(group);

          return (
            <div key={group.label} className="nav-group">
              <button
                className={`nav-group-header ${isActive ? "active" : ""}`}
                onClick={() => !isCollapsed && toggleGroup(group.label)}
                title={isCollapsed ? group.label : undefined}
                disabled={isCollapsed}
              >
                <span className="nav-icon">{group.icon}</span>
                {!isCollapsed && (
                  <>
                    <span className="nav-label">{group.label}</span>
                    <Icon.ChevronDown
                      size="sm"
                      className={`nav-group-chevron ${isExpanded ? "expanded" : ""}`}
                    />
                  </>
                )}
              </button>
              {!isCollapsed && isExpanded && (
                <div className="nav-sublinks">
                  {group.subItems.map((subItem) => (
                    <NavLink
                      key={subItem.path}
                      to={subItem.path}
                      className={({ isActive }) =>
                        `nav-sublink ${isActive ? "active" : ""}`
                      }
                    >
                      <span className="nav-icon">{subItem.icon}</span>
                      <span className="nav-label">{subItem.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-footer-button"
          onClick={() => navigate("/")}
          title={isCollapsed ? "Back to Home" : undefined}
        >
          <Icon.Eye size="sm" />
          {!isCollapsed && <span>Back to Home</span>}
        </button>
      </div>
    </aside>
  );
};

