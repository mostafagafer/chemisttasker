import React from 'react';
import { Box, Button, Card, CardActions, CardContent, CardHeader, Chip, Typography } from '@mui/material';
import { Mail as MailIcon } from '@mui/icons-material';
import { ExplorerPost } from '@chemisttasker/shared-core';

const getRoleLabel = (post: ExplorerPost) => post.roleTitle || post.explorerRoleType || post.roleCategory || 'Explorer';
const getEngagementLabel = (post: ExplorerPost) => {
  if (!post.workType) return null;
  return post.workType.replace('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (t) => t.toUpperCase());
};

const TalentCard: React.FC<{ post: ExplorerPost; onContact: (post: ExplorerPost) => void }> = ({ post, onContact }) => {
  const title = `${getRoleLabel(post)}${post.referenceCode ? ` • Ref-${post.referenceCode}` : ''}`;
  const engagement = getEngagementLabel(post);
  const location = [post.locationSuburb, post.locationState].filter(Boolean).join(', ');
  const coverage = post.coverageRadiusKm ? `+${post.coverageRadiusKm}km` : null;

  return (
    <Card sx={{ borderRadius: 3, overflow: 'hidden', borderColor: 'grey.200' }} variant="outlined">
      <CardHeader
        title={title}
        subheader={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {engagement && <Chip size="small" label={engagement} />}
            {(location || coverage) && (
              <Typography variant="body2" color="text.secondary">
                {location}{coverage ? ` • ${coverage}` : ''}
              </Typography>
            )}
          </Box>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {post.headline && (
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            {post.headline}
          </Typography>
        )}
        {post.body && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {post.body}
          </Typography>
        )}
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button variant="contained" startIcon={<MailIcon />} onClick={() => onContact(post)}>
          Contact
        </Button>
      </CardActions>
    </Card>
  );
};

export default TalentCard;
