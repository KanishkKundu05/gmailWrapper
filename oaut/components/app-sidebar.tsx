"use client"

import * as React from "react"
import { ArchiveX, Command, File, Inbox, RefreshCw, Send, Trash2 } from "lucide-react"
import { useQuery, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"

import { NavUser } from "@/components/nav-user"
import { Label } from "@/components/ui/label"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

const navMain = [
  {
    title: "Inbox",
    url: "#",
    icon: Inbox,
    isActive: true,
  },
  {
    title: "Drafts",
    url: "#",
    icon: File,
    isActive: false,
  },
  {
    title: "Sent",
    url: "#",
    icon: Send,
    isActive: false,
  },
  {
    title: "Junk",
    url: "#",
    icon: ArchiveX,
    isActive: false,
  },
  {
    title: "Trash",
    url: "#",
    icon: Trash2,
    isActive: false,
  },
]

const defaultUser = {
  name: "User",
  email: "",
  avatar: "",
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (diffDays === 1) {
      return "Yesterday"
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  } catch {
    return dateString
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [activeItem, setActiveItem] = React.useState(navMain[0])
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const { setOpen } = useSidebar()

  const currentUser = useQuery(api.users.currentUser)
  const emails = useQuery(api.gmail.getEmails)
  const fetchEmails = useAction(api.gmail.fetchGmailEmails)

  const user = currentUser ? {
    name: currentUser.name ?? currentUser.email ?? "User",
    email: currentUser.email ?? "",
    avatar: currentUser.image ?? "",
  } : defaultUser

  const handleRefreshEmails = async () => {
    setIsRefreshing(true)
    try {
      await fetchEmails()
    } catch (error) {
      console.error("Failed to fetch emails:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Auto-fetch emails on mount if none exist
  React.useEffect(() => {
    if (emails !== undefined && emails.length === 0 && currentUser) {
      handleRefreshEmails()
    }
  }, [emails, currentUser])

  const displayEmails = emails ?? []

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* This is the first sidebar */}
      {/* We disable collapsible and adjust width to icon. */}
      {/* This will make the sidebar appear as icons. */}
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <a href="#">
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <Command className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Acme Inc</span>
                    <span className="truncate text-xs">Enterprise</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        setActiveItem(item)
                        setOpen(true)
                      }}
                      isActive={activeItem?.title === item.title}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>

      {/* This is the second sidebar */}
      {/* We disable collapsible and let it fill remaining space */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-foreground text-base font-medium">
              {activeItem?.title}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefreshEmails}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
              <Label className="flex items-center gap-2 text-sm">
                <span>Unreads</span>
                <Switch className="shadow-none" />
              </Label>
            </div>
          </div>
          <SidebarInput placeholder="Type to search..." />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              {displayEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Inbox className="size-12 mb-4 opacity-50" />
                  <p className="text-sm">No emails yet</p>
                  <p className="text-xs mt-1">Click the refresh button to fetch your emails</p>
                </div>
              ) : (
                displayEmails.map((mail: typeof displayEmails[number]) => (
                  <a
                    href="#"
                    key={mail._id}
                    className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight whitespace-nowrap last:border-b-0"
                  >
                    <div className="flex w-full items-center gap-2">
                      <span className={mail.isRead ? "" : "font-semibold"}>{mail.from}</span>
                      <span className="ml-auto text-xs">{formatDate(mail.date)}</span>
                    </div>
                    <span className={`font-medium ${mail.isRead ? "" : "font-semibold"}`}>
                      {mail.subject}
                    </span>
                    <span className="line-clamp-2 w-[260px] text-xs whitespace-break-spaces text-muted-foreground">
                      {mail.snippet}
                    </span>
                  </a>
                ))
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
