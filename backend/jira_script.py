from jira import JIRA
import json

# Jira API credentials


# Connect to Jira
jira = JIRA(server=JIRA_URL, basic_auth=(EMAIL, API_TOKEN))

def fetch_project_data(project_key, JIRA_URL, EMAIL, API_TOKEN):
    """
    Fetches all data for a given project and stores it in a JSON-like structure.
    """
    project_data = {
        "project_key": project_key,
        "issues": []
    }

    # JQL to exclude closed issues
    jql_query = f'project = "{project_key}" AND statusCategory != Done AND created >= -1y ORDER BY created DESC'

    # Pagination setup
    start_at = 0
    max_results = 50

    while True:
        issues = jira.search_issues(jql_query, startAt=start_at, maxResults=max_results)
        if not issues:
            break

        for issue in issues:
            issue_data = {
                "key": issue.key,
                "summary": issue.fields.summary,
                "description": issue.fields.description,
                "assignee": issue.fields.assignee.displayName if issue.fields.assignee else "Unassigned",
                "status": issue.fields.status.name,
                "issue_type": issue.fields.issuetype.name,
                "parent_id": issue.fields.parent.key if hasattr(issue.fields, 'parent') else None,
                "comments": [],
                "attachments": []
            }
            
            # Fetch comments
            comments = issue.fields.comment.comments
            for comment in comments:
                issue_data["comments"].append({
                    "author": comment.author.displayName,
                    "body": comment.body,
                    "created": comment.created
                })

            # Fetch attachments
            attachments = issue.fields.attachment
            for attachment in attachments:
                issue_data["attachments"].append({
                    "filename": attachment.filename,
                    "url": attachment.content
                })

            # Add issue to project data
            project_data["issues"].append(issue_data)

        # Move to the next batch
        start_at += max_results

    return project_data

def fetch_all_projects():
    """
    Fetches all projects and their data.
    """
    all_projects_data = []

    # Get all projects
    projects = jira.projects()

    for project in projects:
        print(f"Fetching data for project: {project.key} - {project.name}")
        project_data = fetch_project_data(project.key)
        project_data["project_name"] = project.name
        all_projects_data.append(project_data)

    return all_projects_data

def save_to_json(data, filename="jira_data_parent.json"):
    """
    Saves data to a JSON file.
    """
    with open(filename, "w") as json_file:
        json.dump(data, json_file, indent=4)
    print(f"Data saved to {filename}")

if __name__ == "__main__":
    print("Fetching Jira data...")
    all_data = fetch_all_projects()
    save_to_json(all_data)
    print("Done!")
