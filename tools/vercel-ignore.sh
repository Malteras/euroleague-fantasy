#!/bin/sh
# Vercel "Ignored Build Step" (vercel.json ignoreCommand): exit 0 skips the build, exit 1 builds.
# A production build only goes ahead for the current head of main. Deploys can be created out of order (a team save
# from the site and a merge a few seconds apart), and a late build of an older commit would otherwise take the live
# domain and serve old code (#52). Other branches always build. If GitHub can't be reached, build.
[ "$VERCEL_GIT_COMMIT_REF" = "main" ] || exit 1
head=$(git ls-remote "https://github.com/${VERCEL_GIT_REPO_OWNER:-Malteras}/${VERCEL_GIT_REPO_SLUG:-euroleague-fantasy}" refs/heads/main 2>/dev/null | cut -f1)
[ -n "$head" ] || exit 1
if [ "$head" = "$VERCEL_GIT_COMMIT_SHA" ]; then exit 1; fi
echo "Skipping: $VERCEL_GIT_COMMIT_SHA is no longer the head of main ($head)"
exit 0
